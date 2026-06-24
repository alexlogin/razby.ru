import { logAudit } from "@/lib/audit";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getTelegramApiConfig, publicTelegramError, telegramClientOptions, withTimeout } from "@/lib/telegram-runner";

type TelegramAuthPayload = {
  phoneCodeHash: string;
  sessionString: string;
};

type AuthClientLike = {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  sendCode(credentials: { apiId: number; apiHash: string }, phoneNumber: string, forceSMS?: boolean): Promise<{
    phoneCodeHash: string;
    isCodeViaApp: boolean;
  }>;
  signInWithPassword(
    credentials: { apiId: number; apiHash: string },
    params: { password?: (hint?: string) => Promise<string>; onError: (error: Error) => boolean | Promise<boolean> },
  ): Promise<Record<string, unknown>>;
  getMe(inputPeer?: false): Promise<Record<string, unknown>>;
  invoke(request: unknown): Promise<unknown>;
  session: {
    save(): string;
  };
};

const AUTH_TTL_MS = 10 * 60 * 1000;

function expiresAt() {
  return new Date(Date.now() + AUTH_TTL_MS);
}

function isPasswordNeeded(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const rpcMessage = typeof error === "object" && error && "errorMessage" in error ? String((error as { errorMessage?: unknown }).errorMessage) : "";
  return message.includes("SESSION_PASSWORD_NEEDED") || rpcMessage.includes("SESSION_PASSWORD_NEEDED");
}

function isSignUpRequired(result: unknown) {
  return Boolean(result && typeof result === "object" && "className" in result && String((result as { className?: unknown }).className).includes("SignUpRequired"));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function accountUsername(me: Record<string, unknown>, fallback: string) {
  const username = stringValue(me.username);
  return username ? `@${username}` : fallback;
}

function displayName(me: Record<string, unknown>, fallback: string) {
  const first = stringValue(me.firstName);
  const last = stringValue(me.lastName);
  return [first, last].filter(Boolean).join(" ") || fallback;
}

async function cleanupExpired(workspaceId: string) {
  await prisma.telegramAuthSession.deleteMany({
    where: {
      workspaceId,
      expiresAt: { lt: new Date() },
    },
  });
}

async function createAuthClient(workspaceId: string, sessionString = "") {
  const apiConfig = await getTelegramApiConfig(workspaceId);
  const [{ TelegramClient }, { StringSession }] = await Promise.all([import("telegram"), import("telegram/sessions")]);
  const client = new TelegramClient(new StringSession(sessionString), apiConfig.apiId, apiConfig.apiHash, telegramClientOptions()) as unknown as AuthClientLike;

  return { apiConfig, client };
}

function authPayload(row: { encryptedJson: string }) {
  return decryptJson<TelegramAuthPayload>(row.encryptedJson);
}

function publicAuth(row: { id: string; label: string; phone: string; status: string; isCodeViaApp: boolean; expiresAt: Date }) {
  return {
    id: row.id,
    label: row.label,
    phone: row.phone,
    status: row.status,
    isCodeViaApp: row.isCodeViaApp,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function startTelegramAccountConnect(input: {
  workspaceId: string;
  actorId?: string | null;
  label: string;
  phone: string;
  forceSms?: boolean;
}) {
  await cleanupExpired(input.workspaceId);

  const { apiConfig, client } = await createAuthClient(input.workspaceId);

  try {
    await withTimeout(client.connect(), 15_000, "Telegram connection timed out");
    const sent = await withTimeout(
      client.sendCode({ apiId: apiConfig.apiId, apiHash: apiConfig.apiHash }, input.phone, Boolean(input.forceSms)),
      20_000,
      "Telegram code request timed out",
    );

    const row = await prisma.telegramAuthSession.create({
      data: {
        workspaceId: input.workspaceId,
        label: input.label,
        phone: input.phone,
        status: "CODE_SENT",
        encryptedJson: encryptJson({
          phoneCodeHash: sent.phoneCodeHash,
          sessionString: client.session.save(),
        }),
        isCodeViaApp: sent.isCodeViaApp,
        expiresAt: expiresAt(),
      },
    });

    await logAudit({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: "telegram_connect.code_sent",
      entity: "TelegramAuthSession",
      entityId: row.id,
      metadata: { phone: input.phone, label: input.label, viaApp: sent.isCodeViaApp },
    });

    return publicAuth(row);
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

async function completeTelegramConnect(input: {
  workspaceId: string;
  actorId?: string | null;
  authSessionId: string;
  client: AuthClientLike;
  label: string;
  phone: string;
}) {
  const me = await withTimeout(input.client.getMe(false), 10_000, "Telegram getMe timed out");
  const username = accountUsername(me, input.label);
  const finalSessionString = input.client.session.save();

  const integration = await prisma.integrationCredential.upsert({
    where: {
      workspaceId_service_label: {
        workspaceId: input.workspaceId,
        service: "telegram-session",
        label: input.label,
      },
    },
    update: {
      encryptedJson: encryptJson({
        username,
        phone: input.phone,
        sessionString: finalSessionString,
      }),
      status: "READY",
      lastCheckedAt: new Date(),
    },
    create: {
      workspaceId: input.workspaceId,
      service: "telegram-session",
      label: input.label,
      encryptedJson: encryptJson({
        username,
        phone: input.phone,
        sessionString: finalSessionString,
      }),
      status: "READY",
      lastCheckedAt: new Date(),
    },
  });

  const existing = await prisma.telegramAccount.findFirst({
    where: {
      workspaceId: input.workspaceId,
      OR: [{ phone: input.phone }, { username }],
    },
  });

  const account = existing
    ? await prisma.telegramAccount.update({
        where: { id: existing.id },
        data: {
          label: input.label,
          username,
          phone: input.phone,
          status: "READY",
          healthScore: Math.max(existing.healthScore, 84),
          ggrScore: Math.max(existing.ggrScore, 7.2),
          notes: existing.notes || `Connected via Telegram wizard as ${displayName(me, username)}`,
        },
      })
    : await prisma.telegramAccount.create({
        data: {
          workspaceId: input.workspaceId,
          label: input.label,
          username,
          phone: input.phone,
          status: "READY",
          healthScore: 84,
          ggrScore: 7.2,
          notes: `Connected via Telegram wizard as ${displayName(me, username)}`,
        },
      });

  await prisma.telegramAuthSession.delete({ where: { id: input.authSessionId } }).catch(() => undefined);

  await logAudit({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: "telegram_connect.completed",
    entity: "TelegramAccount",
    entityId: account.id,
    metadata: {
      username,
      integrationId: integration.id,
      authSessionId: input.authSessionId,
    },
  });

  return {
    account,
    integration: {
      id: integration.id,
      service: integration.service,
      label: integration.label,
      status: integration.status,
      lastCheckedAt: integration.lastCheckedAt,
    },
  };
}

export async function verifyTelegramAccountConnect(input: {
  workspaceId: string;
  actorId?: string | null;
  authSessionId: string;
  code?: string;
  password?: string;
}) {
  await cleanupExpired(input.workspaceId);

  const row = await prisma.telegramAuthSession.findFirst({
    where: {
      id: input.authSessionId,
      workspaceId: input.workspaceId,
    },
  });

  if (!row) {
    throw new Error("Telegram login session expired. Start connection again.");
  }

  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.telegramAuthSession.delete({ where: { id: row.id } }).catch(() => undefined);
    throw new Error("Telegram login session expired. Start connection again.");
  }

  const payload = authPayload(row);
  const { apiConfig, client } = await createAuthClient(input.workspaceId, payload.sessionString);

  try {
    await withTimeout(client.connect(), 15_000, "Telegram connection timed out");

    if (row.status === "PASSWORD_REQUIRED") {
      if (!input.password?.trim()) {
        return { requiresPassword: true, auth: publicAuth(row) };
      }

      let passwordError: Error | null = null;
      await withTimeout(
        client.signInWithPassword(
          { apiId: apiConfig.apiId, apiHash: apiConfig.apiHash },
          {
            password: async () => input.password!.trim(),
            onError: (error) => {
              passwordError = error;
              return true;
            },
          },
        ),
        20_000,
        "Telegram password check timed out",
      ).catch((error) => {
        throw passwordError ?? error;
      });

      return completeTelegramConnect({
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        authSessionId: row.id,
        client,
        label: row.label,
        phone: row.phone,
      });
    }

    if (!input.code?.trim()) {
      throw new Error("Telegram code is required");
    }

    const { Api } = await import("telegram");

    try {
      const result = await withTimeout(
        client.invoke(
          new Api.auth.SignIn({
            phoneNumber: row.phone,
            phoneCodeHash: payload.phoneCodeHash,
            phoneCode: input.code.trim(),
          }),
        ),
        20_000,
        "Telegram sign-in timed out",
      );

      if (isSignUpRequired(result)) {
        throw new Error("This phone is not registered in Telegram. New account signup is not supported by Razby.");
      }
    } catch (error) {
      if (!isPasswordNeeded(error)) {
        throw error;
      }

      const updated = await prisma.telegramAuthSession.update({
        where: { id: row.id },
        data: {
          status: "PASSWORD_REQUIRED",
          encryptedJson: encryptJson({
            ...payload,
            sessionString: client.session.save(),
          }),
          expiresAt: expiresAt(),
        },
      });

      await logAudit({
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        action: "telegram_connect.password_required",
        entity: "TelegramAuthSession",
        entityId: row.id,
        metadata: { phone: row.phone, label: row.label },
      });

      return { requiresPassword: true, auth: publicAuth(updated) };
    }

    return completeTelegramConnect({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      authSessionId: row.id,
      client,
      label: row.label,
      phone: row.phone,
    });
  } catch (error) {
    throw new Error(publicTelegramError(error));
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}
