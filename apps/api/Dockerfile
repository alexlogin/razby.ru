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

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --prod --frozen-lockfile=false

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/dist-seed apps/api/dist-seed
COPY --from=builder /app/apps/api/prisma apps/api/prisma
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/.prisma apps/api/node_modules/.prisma

WORKDIR /app/apps/api
EXPOSE 4000
# Применяем миграции и запускаем
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
