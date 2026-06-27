/**
 * Тесты платформы Razby: проверяют, что ВСЕ исполняемые модули работают.
 *
 * 1. Unit: для каждого исполняемого модуля есть adapter и execute() возвращает
 *    корректную структуру (summary/stats/rows/policy/nextActions) + политика задана.
 * 2. Целостность: слуги в navigationGroups и allowedSlugs существуют и покрыты адаптерами.
 * 3. Integration: каждый модуль прогоняется через полный движок (queue → process →
 *    complete/approval) на временной SQLite-БД; проверяется финальный статус и результат.
 *
 * Запуск: npm test
 */
// Должно выполниться до динамических import() движка/Prisma ниже.
const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = "test";
env.RAZBY_EXECUTION_MODE = "simulate";
// Уникальный файл БД на каждый прогон — полная изоляция теста.
const DB_NAME = `.test-modules-${process.pid}.db`;
env.DATABASE_URL = `file:./${DB_NAME}`;

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

type Result = { name: string; ok: boolean; error?: string };
const results: Result[] = [];
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => results.push({ name, ok: true }))
    .catch((e) => results.push({ name, ok: false, error: String(e?.message ?? e) }));
}

function sampleInput() {
  // Покрывает все ключевые поля, которые читают адаптеры.
  return {
    targets: "@channel_one\n@channel_two",
    accounts: "@worker_01\n@worker_02",
    channels: "@channel_one",
    groups: "@group_one",
    sources: "@source_one",
    postLinks: "https://t.me/channel/1",
    storyLinks: "@source/story/1",
    targetAccounts: "@worker_01",
    batch: "@new_worker_01",
    proxyPool: "1.2.3.4:1080",
    assignAccounts: "@parser_01",
    securityState: "Сменить облачный пароль",
    keywords: "telegram growth",
    dailyLimit: 1000,
    perPost: 120,
    minMembers: 500,
    days: 7,
  };
}

const dbFile = resolve(process.cwd(), "prisma", DB_NAME);
function cleanDb() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${dbFile}${suffix}`, { force: true });
  }
}

async function main() {
  cleanDb();
  execFileSync("node", ["scripts/init-db.mjs"], { stdio: "ignore", env: process.env });

  const { modules, navigationGroups } = await import("@/lib/modules");
  const { getModuleAdapter } = await import("@/lib/module-adapters");
  const { getModulePolicy } = await import("@/lib/module-policies");

  const executableSlugs = [...modules.map((m) => m.slug), "proxy-checker"];

  // ── 1. Unit: каждый исполняемый модуль имеет рабочий adapter ──
  for (const slug of executableSlugs) {
    await test(`adapter:${slug} execute() returns valid result`, () => {
      const adapter = getModuleAdapter(slug);
      assert.ok(adapter, `нет адаптера для ${slug}`);
      const r = adapter!.execute(sampleInput());
      assert.equal(typeof r.summary, "string");
      assert.ok(r.summary.length > 0, "пустой summary");
      assert.ok(r.stats && typeof r.stats === "object", "нет stats");
      assert.ok(Array.isArray(r.rows), "rows не массив");
      assert.ok(r.rows.length > 0, "пустой rows");
      assert.ok(Array.isArray(r.nextActions) && r.nextActions.length > 0, "нет nextActions");
      const policy = r.policy ?? getModulePolicy(slug);
      assert.ok(["low", "medium", "high"].includes(policy.risk), "некорректный risk");
      assert.ok(["auto", "manual", "required"].includes(policy.approval), "некорректный approval");
    });
  }

  // ── 2. Целостность каталога ──
  await test("navigationGroups: все слуги существуют в modules", () => {
    const known = new Set(modules.map((m) => m.slug));
    for (const group of navigationGroups) {
      for (const slug of group.slugs) {
        assert.ok(known.has(slug), `navigationGroups ссылается на несуществующий ${slug}`);
      }
    }
  });
  await test("каждый исполняемый модуль покрыт adapter и policy", () => {
    for (const slug of executableSlugs) {
      assert.ok(getModuleAdapter(slug), `нет adapter: ${slug}`);
      assert.ok(getModulePolicy(slug), `нет policy: ${slug}`);
    }
  });

  // ── 3. Integration: полный прогон через движок на временной БД ──
  const { prisma } = await import("@/lib/prisma");
  const { ensureWorkspace } = await import("@/lib/workspace");
  const { createModuleRun } = await import("@/lib/module-engine");

  const user = await prisma.user.create({
    data: { email: "test-owner@razby.local", name: "Test Owner", role: "OWNER" },
  });
  const workspace = await ensureWorkspace(user.id);

  for (const slug of executableSlugs) {
    await test(`engine:${slug} полный прогон → завершён`, async () => {
      const run = await createModuleRun(workspace.id, slug, sampleInput(), user.id);
      assert.ok(
        ["COMPLETED", "PENDING_APPROVAL"].includes(run.status),
        `${slug}: неожиданный статус ${run.status}`,
      );
      assert.ok(run.resultJson, `${slug}: нет результата`);
      const result = JSON.parse(run.resultJson!);
      assert.ok(Array.isArray(result.rows) && result.rows.length > 0, `${slug}: пустой результат`);
    });
  }

  // парсинг-модули должны создавать лиды
  await test("engine: парсинг создаёт лиды в БД", async () => {
    const leads = await prisma.lead.count({ where: { workspaceId: workspace.id } });
    assert.ok(leads > 0, "парсинг-модули не создали ни одного лида");
  });
  // аудит пишется
  await test("engine: пишется аудит-лог запусков", async () => {
    const audits = await prisma.auditLog.count({ where: { workspaceId: workspace.id } });
    assert.ok(audits > 0, "не записан ни один аудит-лог");
  });

  await prisma.$disconnect();
  cleanDb();

  // ── отчёт ──
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\nМодулей исполняемых: ${executableSlugs.length}`);
  for (const f of failed) console.log(`  ✗ ${f.name}\n     ${f.error}`);
  console.log(`\n${passed}/${results.length} тестов прошли.`);
  if (failed.length > 0) {
    console.error(`\nПРОВАЛено тестов: ${failed.length}`);
    process.exit(1);
  }
  console.log("Все тесты прошли ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
