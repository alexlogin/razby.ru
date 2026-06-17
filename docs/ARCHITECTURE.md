# Архитектура Razby.ru

## Обзор

Монорепо (pnpm workspaces) из трёх частей:

- **`apps/api`** — NestJS, модульная архитектура, REST + WebSocket, Prisma.
- **`apps/web`** — Next.js App Router (PWA), общается с API по REST, токены с авто-ротацией.
- **`packages/shared`** — единый контракт: роли, перечисления, веса алгоритма сравнения,
  типы ответов API. Используется и бэкендом, и фронтендом — статусы/роли не расходятся.

```
[ Браузер / PWA ]
        │  HTTPS
   [ Nginx ]  ── /api → API,  /ws → WebSocket,  /files → хранилище,  / → Web
        │
   ┌────┴─────┐
[ NestJS API ]──[ PostgreSQL ]   (Prisma, миграции, транзакции)
        │     └─[ Redis ]        (BullMQ, кеш, троттлинг)
        └─[ Провайдеры ]: Storage(S3/mock), SMS, Email, Payments
```

## Принцип расчётов

Числа никогда не «придумываются». Поток:

```
Анкета (ответы) ──► variableKey ──► входные переменные формулы
Формула (активная версия) ──► выражение (expr-eval, без eval)
   ──► × коэффициент запаса ──► × региональный коэффициент (если включён)
   ──► min/max ──► округление ──► итог + полная трассировка (calcTrace)
```

- Формулы хранятся в `Formula` + `FormulaVersion` (версии с `validFrom/validTo`, автором,
  выражением, переменными, коэффициентами, округлением).
- Расчёт детерминирован и воспроизводим; каждая позиция материала проекта хранит
  `formulaKey`, `formulaVersion` и `calcTrace` (входы, raw, afterSafety, afterRegion, final).
- Цены берутся из `RegionalPrice` (история цен по регионам), а не из формул.

См. `apps/api/src/formulas/formula-eval.service.ts` и `projects/estimate-builder.service.ts`.

## Доменная модель (основное)

- **Пользователи/доступ**: `User`, `ProviderProfile`, `RefreshToken`, `VerificationToken`,
  `Document`. RBAC по 7 ролям. Refresh-токены хранятся хешированными, ротация по семействам.
- **Справочники**: `Region`, `MaterialCategory`, `Material`, `RegionalPrice`, `Specialist`,
  `Equipment`, `Risk`.
- **Движок**: `Formula`, `FormulaVersion`.
- **Шаблоны**: `ProjectTemplate`, `Questionnaire`, `Question`, `QuestionOption`,
  `StageTemplate` (+ материалы/специалисты/техника/риски/зависимости).
- **Проект**: `Project`, `ProjectAnswer`, `ProjectStage` (+ зависимости, материалы),
  `Estimate`/`EstimateItem` (версии — история сметы), `Tender`, `Offer`, `Delivery`,
  `Payment`, `Review`, `Dispute`, `Conversation`/`Message`, `Notification`, `PhotoReport`,
  `AcceptanceAct`.
- **Системное**: `CommissionRule`, `PromoCode`, `AuditLog`, `SystemSetting`.

## Модули бэкенда

| Модуль          | Ответственность                                                          |
| --------------- | ----------------------------------------------------------------------- |
| `auth`          | регистрация, вход, refresh с ротацией, подтверждение email/телефона, сброс пароля |
| `users`         | профиль пользователя и исполнителя                                       |
| `catalog`       | шаблоны, анкеты, регионы, материалы (чтение)                             |
| `formulas`      | CRUD формул и версий, безопасное вычисление, dry-run                      |
| `projects`      | проекты, ответы анкеты, расчёт сметы, этапы (расписание, зависимости, приёмка) |
| `offers`        | тендеры, предложения, **алгоритм сравнения**, выбор исполнителя           |
| `export`        | смета в PDF (pdfkit) и Excel (exceljs)                                   |
| `uploads`       | загрузка файлов с проверкой MIME и размера                               |
| `admin`         | аналитика, пользователи, верификация, цены, комиссии, промокоды, аудит, настройки |
| `notifications` | уведомления + рассылка по WebSocket                                      |
| `realtime`      | WebSocket-шлюз (комнаты user:/project:)                                  |
| `audit`         | журнал действий (глобальный сервис)                                      |
| `providers`     | интерфейсы внешних сервисов + mock-реализации                            |

## Алгоритм сравнения предложений

`offers/comparison.service.ts`. Для набора предложений считается взвешенный score (0–100)
по нормализованным критериям: **цена, рейтинг, отзывы, завершённые заказы, верификация,
гарантия, соблюдение сроков, доля отмен, расстояние** до объекта (haversine). Веса заданы
в `packages/shared` (`DEFAULT_COMPARISON_WEIGHTS`). Дополнительно отмечаются 4 варианта:
самый дешёвый, оптимальный (макс. score), самый быстрый, с максимальным рейтингом.

## Правила запуска этапа

`projects/stages.service.ts → checkReadiness`. Этап нельзя начать, если: не принят
предыдущий этап (зависимости), не заказаны материалы, не выбран исполнитель, не подтверждена
дата, не выполнен обязательный чек-лист. При приёмке этапа формируется акт и
разблокируются зависимые этапы.

## Безопасность

- Пароли — argon2id. JWT access (короткий) + refresh (ротация, отзыв семейства при
  повторном использовании). Смена роли/сброс пароля инвалидирует токены (`tokenVersion`).
- Глобальные guard'ы: `JwtAuthGuard` + `RolesGuard`. Throttling (`@nestjs/throttler`).
- Валидация DTO (`class-validator`, whitelist + forbidNonWhitelisted). Helmet.
- Защита от IDOR: `assertAccess` на проектах проверяет владельца/координатора/участника.
- Загрузки: проверка MIME и размера. Аудит критических операций.

## Тестирование

- Юнит: движок формул (`formula-eval.service.spec.ts`) и сравнение
  (`comparison.service.spec.ts`).
- Сквозной сценарий проверяется через REST (см. README, демо-сценарий).
