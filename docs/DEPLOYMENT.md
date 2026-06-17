# Развёртывание на VPS

Инструкция для одной VPS (Ubuntu 22.04+) с Docker. Платформа поднимается одной командой:
PostgreSQL, Redis, API, Web и Nginx как реверс-прокси.

## 1. Подготовка сервера

```bash
# Docker + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER     # перелогиньтесь после этого

# Файрвол
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 2. Код и переменные окружения

```bash
git clone <repo-url> razby && cd razby
cp .env.example .env
```

Обязательно отредактируйте `.env` для продакшена:

```ini
NODE_ENV=production

# Сильные случайные секреты (например: openssl rand -base64 48)
JWT_ACCESS_SECRET=<случайная строка ≥32 симв>
JWT_REFRESH_SECRET=<другая случайная строка ≥32 симв>

# Пароль БД
POSTGRES_PASSWORD=<надёжный пароль>
DATABASE_URL=postgresql://razby:<надёжный пароль>@postgres:5432/razby?schema=public

# Домен
CORS_ORIGINS=https://razby.ru
NEXT_PUBLIC_API_URL=https://razby.ru/api
NEXT_PUBLIC_WS_URL=https://razby.ru
STORAGE_PUBLIC_URL=https://razby.ru/files
```

> Секреты держите только в `.env` на сервере (он в `.gitignore`). Не коммитьте их.

## 3. Запуск

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

Это поднимет 5 сервисов. API при старте автоматически выполняет `prisma migrate deploy`.
Состояние:

```bash
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml logs -f api
```

## 4. Наполнение данными (один раз)

```bash
docker compose -f infra/docker-compose.yml exec api sh -c "cd /app/apps/api && node -e \"require('child_process').execSync('npx prisma db seed',{stdio:'inherit'})\""
# либо, если в образе доступен ts-node:
docker compose -f infra/docker-compose.yml exec api npx prisma db seed
```

> Для прода рекомендуется отдельный seed только справочников и одного администратора —
> отредактируйте `apps/api/prisma/seed.ts` (уберите демо-подрядчиков), пересоберите образ.

## 5. HTTPS

Терминируйте TLS на внешнем балансировщике/прокси или замените `infra/nginx/nginx.conf`
на конфигурацию с сертификатами. Быстрый вариант — Let's Encrypt через отдельный
контейнер companion (nginx-proxy + acme) или системный Nginx перед Docker:

```nginx
server {
    listen 443 ssl http2;
    server_name razby.ru;
    ssl_certificate     /etc/letsencrypt/live/razby.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/razby.ru/privkey.pem;

    location / { proxy_pass http://127.0.0.1:80; proxy_set_header Host $host; }
}
server {
    listen 80;
    server_name razby.ru;
    return 301 https://$host$request_uri;
}
```

Получение сертификата:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d razby.ru
```

## 6. Резервные копии

База:

```bash
# Бэкап
docker compose -f infra/docker-compose.yml exec -T postgres \
  pg_dump -U razby razby | gzip > backups/razby-$(date +%F).sql.gz

# Восстановление
gunzip -c backups/razby-2026-01-01.sql.gz | \
  docker compose -f infra/docker-compose.yml exec -T postgres psql -U razby razby
```

Файлы хранилища лежат в томе `storage` (или в S3, если `STORAGE_DRIVER=s3`). Настройте
cron на ежедневный `pg_dump` и синхронизацию каталога/бакета.

## 7. Обновление

```bash
git pull
docker compose -f infra/docker-compose.yml up -d --build
# миграции применятся автоматически при старте api
```

## 8. Health checks и мониторинг

- `GET /health` — liveness, `GET /health/ready` — readiness (проверка БД).
- Healthcheck'и настроены в `docker-compose.yml` для postgres, redis и api.
- Логи: `docker compose ... logs -f api`. Логи структурированы (pino) — их удобно
  направлять в централизованный сборщик (Loki/ELK).

## 9. Переход на реальные внешние сервисы

| Сервис    | Переменные                                            |
| --------- | ----------------------------------------------------- |
| S3        | `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| SMS       | `SMS_DRIVER=smsc`, `SMS_API_KEY`                      |
| Email     | `EMAIL_DRIVER=smtp`, SMTP-настройки                   |
| Платежи   | `PAYMENTS_DRIVER=yookassa`, `PAYMENTS_SECRET_KEY`     |

Для каждого сервиса в `apps/api/src/providers/*` есть интерфейс — добавьте реальную
реализацию рядом с mock и зарегистрируйте её в `providers.module.ts` по значению драйвера.
