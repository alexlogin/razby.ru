# Razby.ru — заметки проекта

Платформа «Разберу стройку на части». Монорепо: `apps/api` (NestJS), `apps/web` (Next.js PWA),
`packages/shared`. Подробности — в `README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`.

## Рабочая ветка
`claude/gifted-goldberg-nfq09o` (PR #1, draft, base `main`). CI: `.github/workflows/ci.yml`.

## Деплой (production)

- **Сервер (VPS): `89.111.131.180`**
- **Домен:** `razby.ru` (DNS указывает на сервер)
- **HTTPS:** автоматический (Caddy + Let's Encrypt), `infra/caddy/Caddyfile`
- **Стек:** `infra/docker-compose.prod.yml` (Postgres, Redis, API, Web, Caddy)
- **Скрипт на сервере:** `scripts/deploy.sh [--seed] [--no-pull]`
- **Автодеплой:** `.github/workflows/deploy.yml` — rsync+SSH, триггер: push в `main` и ручной запуск.

### Секреты GitHub Actions для автодеплоя (заполняет владелец)
`DEPLOY_HOST` (=89.111.131.180), `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_DOMAIN` (=razby.ru),
`DEPLOY_ACME_EMAIL`, `DEPLOY_PORT` (опционально).

### Тестовые аккаунты (после seed)
Суперадмин `alexeyloginov90@gmail.com` / `Razby-Super-2025!`; остальные роли — пароль `Razby2025!`.
В боевом режиме сменить пароль суперадмина и убрать демо-пользователей из `apps/api/prisma/seed.ts`.

## Команды
`pnpm build` · `pnpm test` · `pnpm typecheck` · `pnpm --filter @razby/api prisma:seed`
