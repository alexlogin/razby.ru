# ─── Сборка ───
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app

# Манифесты для кэша зависимостей
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false

# Исходники
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @razby/shared build
RUN pnpm --filter @razby/api prisma:generate
RUN pnpm --filter @razby/api build
RUN pnpm --filter @razby/api build:seed

# ─── Runtime ───
FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

# Берём весь собранный проект из builder (включая node_modules с Prisma-клиентом).
# Надёжно для pnpm-монорепо (символические ссылки и сгенерированный клиент на месте).
COPY --from=builder /app /app

WORKDIR /app/apps/api
EXPOSE 4000
# Применяем миграции и запускаем
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
