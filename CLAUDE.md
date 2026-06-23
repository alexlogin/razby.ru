# Razby — заметки проекта

Платформа Razby (операции в Telegram). Один Next.js-проект (App Router) + воркер модулей.
Бэкенд (`/api/*`) обслуживается тем же Next.js-приложением. БД — SQLite (Prisma).
Код перенесён из приложения Supergram и ребрендирован: бренд **Razby**, идентификаторы `razby`,
env-префикс `RAZBY_`. Подробности — в `README.md`.

## Рабочая ветка
`claude/nice-euler-le8ama` (draft PR, base — дефолтная ветка). CI: `.github/workflows/ci.yml`.

## Структура
- `src/` — Next.js App Router (UI + API routes), `src/lib` — логика, `src/components` — UI.
- `prisma/` — схема SQLite, `scripts/init-db.mjs` — инициализация БД, `scripts/worker.ts` — воркер.
- `Dockerfile`, `docker-compose.yml` — локально; `infra/docker-compose.prod.yml` + `infra/caddy/Caddyfile` — production.

## Деплой (production)

- **Сервер (VPS): `89.111.131.180`**
- **Домен:** `razby.ru` (DNS указывает на сервер)
- **HTTPS:** автоматический (Caddy + Let's Encrypt), `infra/caddy/Caddyfile`
- **Стек:** `infra/docker-compose.prod.yml` (web — приложение Razby, worker, caddy), compose-проект `razby-prod`
- **Скрипт на сервере:** `scripts/deploy.sh [--seed] [--no-pull]` — бэкап томов `razby-prod_*` в `backups/`,
  затем `docker compose up -d --build --remove-orphans` (старые контейнеры прежнего сайта удаляются как orphans;
  их тома остаются на диске). Caddy владеет только 80/443 — другие сайты на VPS не затрагиваются.
- **Автодеплой:** `.github/workflows/deploy.yml` — rsync+SSH, триггер: push в `main` и ручной запуск (workflow_dispatch).

### Секреты GitHub Actions для автодеплоя (заполняет владелец)
`DEPLOY_HOST` (=89.111.131.180), `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_DOMAIN` (=razby.ru),
`DEPLOY_ACME_EMAIL`, `DEPLOY_PORT` (опционально).

## Команды
`npm run db:init` · `npm run build` · `npm run start` · `npm run worker:watch` · `npm run db:seed`
