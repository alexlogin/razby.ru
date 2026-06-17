# Локальный запуск

## Требования

- Node.js 20+
- pnpm 9 (`corepack enable`)
- PostgreSQL 16
- Redis 7

## Шаги

```bash
# 1. Зависимости
pnpm install
pnpm --filter @razby/shared build

# 2. Переменные окружения
cp .env.example .env
# Проверьте DATABASE_URL и REDIS_URL под вашу установку.

# 3. База данных
cd apps/api
pnpm prisma generate
pnpm prisma migrate dev          # создаёт и применяет миграции
pnpm prisma:seed                 # справочники, шаблон погреба, тестовые аккаунты
cd ../..

# 4. Запуск
pnpm dev                         # api: 4000, web: 3000
```

Swagger доступен на `http://localhost:4000/api/docs`.

## Переменные окружения

| Переменная             | Назначение                                       | По умолчанию                |
| ---------------------- | ------------------------------------------------ | --------------------------- |
| `DATABASE_URL`         | строка подключения PostgreSQL                    | localhost:5432              |
| `REDIS_URL`            | подключение Redis (BullMQ)                        | localhost:6379              |
| `PORT`                 | порт API                                          | 4000                        |
| `CORS_ORIGINS`         | список разрешённых origin через запятую           | http://localhost:3000       |
| `JWT_ACCESS_SECRET`    | секрет access-токена (≥32 символов в проде)       | dev-значение                |
| `JWT_REFRESH_SECRET`   | секрет refresh-токена                             | dev-значение                |
| `JWT_ACCESS_TTL`       | время жизни access-токена                         | 15m                         |
| `JWT_REFRESH_TTL`      | время жизни refresh-токена                        | 30d                         |
| `STORAGE_DRIVER`       | `mock` или `s3`                                   | mock                        |
| `STORAGE_PUBLIC_URL`   | базовый URL для отдачи файлов                      | http://localhost:4000/files |
| `SMS_DRIVER`           | `mock` или `smsc`                                 | mock                        |
| `EMAIL_DRIVER`         | `mock` или `smtp`                                 | mock                        |
| `PAYMENTS_DRIVER`      | `mock` или `yookassa`                             | mock                        |
| `UPLOAD_MAX_MB`        | макс. размер файла                                 | 25                          |
| `UPLOAD_ALLOWED_MIME`  | разрешённые MIME-типы через запятую                | jpeg,png,webp,pdf,mp4       |
| `NEXT_PUBLIC_API_URL`  | URL API для фронтенда                              | http://localhost:4000/api   |
| `NEXT_PUBLIC_WS_URL`   | URL WebSocket                                      | http://localhost:4000       |

## Полезные команды

```bash
pnpm test                                   # юнит-тесты
pnpm --filter @razby/api test               # тесты бэкенда
pnpm --filter @razby/api prisma:studio      # GUI к БД
pnpm --filter @razby/api prisma migrate dev --name <имя>   # новая миграция
pnpm build                                  # production-сборка
```

## Проверка mock-провайдеров

- **Коды подтверждения email/телефона** и **письма восстановления пароля** выводятся в
  лог API (`MockSMS`, `MockEmail`).
- **Загруженные файлы** сохраняются в `apps/api/storage/` и отдаются по `/files/...`.
- **Платежи** эмулируют удержание/выплату в памяти (`MockPayment`).
