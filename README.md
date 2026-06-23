# Razby

Razby — премиальная платформа операций в Telegram с собственным дизайном продукта.

## Что внутри

- Вход по email-коду, резервный вход владельца по коду для запуска на IP-only VPS и кабинет, готовый к Google OAuth для будущего домена.
- Дашборд воркспейса, Telegram-аккаунты, кампании, лиды, единый инбокс, очередь подтверждений и аудит-лог.
- Модули операций в Telegram: папки, сторис, защита продавца и единый инбокс.
- Очередь воркера модулей, политики модулей, риск-гейты и проверки готовности.
- Гейты ручного подтверждения для рискованного ИИ, сторис, реакций и действий воркера до боевого запуска.
- Защищённое хранилище интеграций: Telegram API, сессии Telegram, ИИ-провайдер, бот и воркер.
- Проверка прокси, экспорт CSV и production-эндпоинт здоровья.
- Docker, docker-compose, systemd-юниты и GitHub CI.

## Локальный запуск

```bash
npm install
cp .env.example .env
npm run db:init
npm run build
npm run start
```

Воркер:

```bash
npm run worker:watch
```

Health:

```bash
curl http://127.0.0.1:3000/api/health
```

## Production-деплой на razby.ru

Боевой стек живёт в `infra/docker-compose.prod.yml` (приложение Razby + воркер + Caddy с
автоматическим HTTPS). Деплой выполняется через GitHub Actions (`.github/workflows/deploy.yml`):
раннер заливает код на VPS по rsync+SSH и запускает `scripts/deploy.sh`.

- **Сервер (VPS):** `89.111.131.180`
- **Домен:** `razby.ru`
- **HTTPS:** Caddy + Let's Encrypt (`infra/caddy/Caddyfile`)
- **Скрипт на сервере:** `scripts/deploy.sh [--seed] [--no-pull]`

`deploy.sh` перед переключением делает резервную копию томов прошлого стека (`razby-prod_*`)
в `backups/` и аккуратно заменяет старый сайт, не трогая другие сайты на VPS.

Перед боевым запуском задайте на сервере в `.env`:

- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (генерируется автоматически)
- `RAZBY_OWNER_ACCESS_CODE` — резервный вход владельца по IP (генерируется автоматически)
- `RAZBY_EMAIL_AUTH_ENABLED=true`, `RAZBY_AUTH_EMAILS`, `RAZBY_EMAIL_FROM`, `RAZBY_RESEND_API_KEY` — вход по email-коду
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — после подключения домена
- `RAZBY_DEMO_MODE=false`, `RAZBY_EXECUTION_MODE=live`
- `RAZBY_ADMIN_TOKEN` — защищённый bootstrap-доступ к админке

В режиме `live` модули Telegram блокируются, пока не готовы Telegram API, сессии, аккаунты,
прокси и heartbeat воркера. Страница Admin хранит ключи OpenRouter, Telegram, Google OAuth и
воркера зашифрованными в БД. Google OAuth дополнительно копируется в `.env` и требует перезапуска,
так как NextAuth читает провайдеров при старте процесса.
