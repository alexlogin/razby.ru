# Развёртывание на VPS (razby.ru)

Production-стек поднимается одной командой: PostgreSQL, Redis, API, Web и **Caddy** как
реверс-прокси с **автоматическим HTTPS** (Let's Encrypt). Наружу открыт только Caddy
(порты 80/443); БД и Redis доступны лишь внутри docker-сети.

## 1. Предусловия

- VPS (Ubuntu 22.04+), Docker + плагин compose, `openssl`, `git`.
- **DNS razby.ru (и при желании www.razby.ru) указывает A-записью на IP сервера** —
  Caddy выпустит сертификат автоматически при первом запросе.

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER     # перелогиньтесь
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## 2. Деплой одной командой

```bash
git clone <repo-url> razby && cd razby

# Первый запуск (создаст .env, сгенерирует секреты, соберёт, поднимет, наполнит БД):
./scripts/deploy.sh --seed
```

Скрипт:

1. создаёт `.env` из `.env.production.example`, если его нет;
2. генерирует случайные `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   (если оставлены заглушки `CHANGE_ME`);
3. делает `git pull` (можно отключить `--no-pull`);
4. собирает и поднимает контейнеры (`docker-compose.prod.yml`);
5. ждёт готовности API (миграции применяются автоматически при старте контейнера);
6. при флаге `--seed` наполняет БД (справочники, шаблон погреба, тестовые аккаунты).

Перед первым запуском отредактируйте в `.env` как минимум:

```ini
DOMAIN=razby.ru
ACME_EMAIL=ваш-email@razby.ru   # для Let's Encrypt
```

После завершения сайт доступен по `https://razby.ru`.

> ⚠️ Для боевого продакшена замените демо-сидинг: в `apps/api/prisma/seed.ts` уберите
> тестовых подрядчиков/заказчика и оставьте только справочники и одного администратора,
> затем пересоберите образ. Либо запускайте без `--seed` и создавайте администратора вручную.

## 3. Обновление версии

```bash
./scripts/deploy.sh           # git pull + пересборка + перезапуск (без повторного seed)
```

## 4. Резервные копии

```bash
# Бэкап БД
docker compose -f infra/docker-compose.prod.yml exec -T postgres \
  pg_dump -U razby razby | gzip > backups/razby-$(date +%F).sql.gz

# Восстановление
gunzip -c backups/razby-2026-01-01.sql.gz | \
  docker compose -f infra/docker-compose.prod.yml exec -T postgres psql -U razby razby
```

Загруженные файлы лежат в томе `storage` (или в S3 при `STORAGE_DRIVER=s3`). Настройте cron
на ежедневный `pg_dump` и синхронизацию тома/бакета в отдельное хранилище.

## 5. Health checks и логи

- `GET /health` — liveness, `GET /health/ready` — readiness (проверка БД).
- Healthcheck'и настроены для postgres, redis и api в `docker-compose.prod.yml`.
- Логи: `docker compose -f infra/docker-compose.prod.yml logs -f api` (структурированные, pino).

## 6. Переход на реальные внешние сервисы

По умолчанию хранилище/SMS/email/платежи работают через mock. Для боевого режима задайте в
`.env` драйверы и ключи:

| Сервис    | Переменные                                                          |
| --------- | ------------------------------------------------------------------- |
| S3        | `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| SMS       | `SMS_DRIVER=smsc`, `SMS_API_KEY`                                     |
| Email     | `EMAIL_DRIVER=smtp` + SMTP-настройки                                 |
| Платежи   | `PAYMENTS_DRIVER=yookassa`, `PAYMENTS_SECRET_KEY`                    |

Для каждого сервиса в `apps/api/src/providers/*` есть интерфейс — добавьте реальную
реализацию рядом с mock и зарегистрируйте её в `providers.module.ts` по значению драйвера.

## 7. Автодеплой через GitHub Actions

Workflow `.github/workflows/deploy.yml` заливает код на сервер (rsync по SSH) и запускает
`scripts/deploy.sh`. Триггеры: пуш в `main` и ручной запуск (Actions → Deploy → Run workflow,
с галочкой `seed` для первого раза).

**Что нужно один раз настроить:**

1. **Сервер**: установлен Docker, есть пользователь с SSH-доступом, в `~/.ssh/authorized_keys`
   добавлен публичный ключ деплоя. На сервере должен быть `rsync` (`apt install -y rsync`).
2. **Секреты репозитория** (Settings → Secrets and variables → Actions → New repository secret):

   | Секрет              | Значение                                              |
   | ------------------- | ----------------------------------------------------- |
   | `DEPLOY_HOST`       | IP или домен сервера                                  |
   | `DEPLOY_USER`       | SSH-пользователь (напр. `root` или `deploy`)          |
   | `DEPLOY_SSH_KEY`    | приватный SSH-ключ деплоя (целиком)                   |
   | `DEPLOY_PORT`       | порт SSH (опционально, по умолчанию 22)               |
   | `DEPLOY_DOMAIN`     | `razby.ru`                                             |
   | `DEPLOY_ACME_EMAIL` | e-mail для Let's Encrypt                               |

Первый деплой — вручную с включённым `seed`. Дальше каждый пуш в `main` деплоит автоматически.
Секреты приложения (`POSTGRES_PASSWORD`, JWT) генерируются на сервере при первом запуске и
сохраняются в `~/razby/.env` (rsync его не перезаписывает).

## 8. Ручной режим (без скрипта)

```bash
cp .env.production.example .env   # заполните DOMAIN, ACME_EMAIL, секреты
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build
# одноразовый seed:
docker compose -f infra/docker-compose.prod.yml exec -T api node dist-seed/seed.js
```
