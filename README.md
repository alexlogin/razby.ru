# Razby.ru — «Разберу стройку на части»

Производственная веб-платформа, которая разбивает строительный проект на этапы,
считает материалы **формулами** (а не «на глаз» и не ИИ), собирает предложения
подрядчиков, поставщиков и перевозчиков, сравнивает их по нескольким критериям и
помогает заказчику построить дешевле, чем «под ключ».

Первый сценарий — **монтаж пластикового погреба** (16 этапов).

## Ключевой принцип

ИИ используется только для понимания запроса (текст, фото, документы). Все числовые
значения — объёмы, количества материалов, нормы — вычисляются формулами, которые
хранятся в БД, версионируются и редактируются администратором без изменения кода.

## Технологии

| Слой         | Стек                                                                 |
| ------------ | -------------------------------------------------------------------- |
| Frontend     | Next.js 14 (App Router), React, TypeScript, Tailwind, PWA            |
| Backend      | NestJS, TypeScript, REST + WebSocket, Swagger, RBAC                  |
| Данные       | PostgreSQL, Prisma ORM, миграции, seed, транзакции, индексы          |
| Инфраструктура | Redis, Docker Compose, Nginx, S3-совместимое хранилище (mock)       |

## Структура монорепо

```
razby.ru/
├── apps/
│   ├── api/            # NestJS backend
│   │   ├── prisma/     # schema.prisma, миграции, seed
│   │   └── src/        # модули: auth, projects, formulas, offers, admin, …
│   └── web/            # Next.js frontend (App Router, PWA)
├── packages/
│   └── shared/         # общие типы, роли, перечисления, веса сравнения
├── infra/
│   ├── docker-compose.yml
│   └── nginx/
└── docs/               # запуск и деплой
```

## Быстрый старт (Docker)

```bash
cp .env.example .env          # при необходимости поправьте секреты
docker compose -f infra/docker-compose.yml up -d --build
# API:     http://localhost:4000/api/docs (Swagger)
# Web:     http://localhost:3000
# Через Nginx: http://localhost
```

Контейнер API при старте сам применяет миграции. Для наполнения данными выполните seed
(см. ниже).

## Локальный запуск без Docker

Нужны Node.js 20+, pnpm 9, PostgreSQL 16, Redis 7.

```bash
pnpm install
pnpm --filter @razby/shared build

# БД
cp .env.example .env
cd apps/api
pnpm prisma migrate deploy      # или: pnpm prisma migrate dev
pnpm prisma:seed                # тестовые данные и аккаунты
cd ../..

# Запуск (в двух терминалах или через pnpm dev)
pnpm dev
# api → http://localhost:4000 , web → http://localhost:3000
```

## Тестовые аккаунты (после seed)

| Роль             | Email                          | Пароль              |
| ---------------- | ------------------------------ | ------------------- |
| Суперадмин       | alexeyloginov90@gmail.com      | `Razby-Super-2025!` |
| Администратор    | admin@razby.ru                 | `Razby2025!`        |
| Координатор      | coordinator@razby.ru           | `Razby2025!`        |
| Заказчик         | customer@razby.ru              | `Razby2025!`        |
| Подрядчики       | contractor@razby.ru, contractor2@razby.ru, contractor3@razby.ru | `Razby2025!` |
| Поставщик        | supplier@razby.ru              | `Razby2025!`        |
| Перевозчик       | carrier@razby.ru               | `Razby2025!`        |

## Демо-сценарий

1. Войдите как `customer@razby.ru`.
2. «Новый проект» → шаблон «Монтаж пластикового погреба» → заполните анкету (длина/ширина/высота
   погреба, грунт, грунтовые воды) → «Рассчитать смету».
3. Откройте проект: финансовый дашборд, экономия против «под ключ», 16 этапов, смета,
   экспорт в PDF/Excel.
4. На этапе «Собрать предложения» создаётся тендер. Войдите подрядчиками и подайте
   предложения на `/tenders`, затем у заказчика сравните их (самый дешёвый / оптимальный /
   самый быстрый / с лучшим рейтингом) и выберите исполнителя.

## Команды

```bash
pnpm build          # сборка shared + api + web
pnpm test           # юнит-тесты (движок формул, сравнение предложений)
pnpm typecheck      # проверка типов
pnpm lint           # ESLint
pnpm --filter @razby/api prisma:studio   # просмотр БД
```

## Документация

- [docs/RUNNING.md](docs/RUNNING.md) — подробный локальный запуск и переменные окружения
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — развёртывание на VPS
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — архитектура и доменная модель

## Внешние сервисы

Для хранилища (S3), SMS, Email и платежей определены интерфейсы провайдеров и рабочие
**mock-реализации** (`apps/api/src/providers/*`). Локально всё работает без внешних
сервисов: файлы пишутся в `storage/`, коды подтверждения и письма выводятся в лог,
платежи эмулируют эскроу. Для прод-режима достаточно подменить класс провайдера.
