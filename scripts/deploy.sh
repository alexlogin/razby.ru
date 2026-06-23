#!/usr/bin/env bash
#
# Развёртывание razby.ru (приложение Razby) на VPS одной командой.
#   ./scripts/deploy.sh            — собрать и (пере)запустить стек
#   ./scripts/deploy.sh --seed     — то же + наполнить БД (npm run db:seed)
#   ./scripts/deploy.sh --no-pull  — не делать git pull (используется автодеплоем из CI)
#
# Требования на сервере: Docker + docker compose, openssl, DNS razby.ru → этот сервер.
#
# Безопасная замена старого сайта:
#   • стек живёт в compose-проекте razby-prod и владеет только портами 80/443 через Caddy
#     (как и раньше) — другие сайты на VPS не затрагиваются;
#   • перед переключением делается резервная копия томов старого проекта (razby-prod_*)
#     в каталог backups/;
#   • старые контейнеры (api/postgres/redis старого сайта) удаляются как orphans,
#     их тома НЕ удаляются и остаются на диске как дополнительный бэкап.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
COMPOSE=(docker compose -f infra/docker-compose.prod.yml --env-file "$ROOT/.env")

SEED=false
NO_PULL=false
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=true ;;
    --no-pull) NO_PULL=true ;;
    *) echo "Неизвестный аргумент: $arg" >&2; exit 1 ;;
  esac
done

# 1. .env
if [ ! -f .env ]; then
  cp .env.production.example .env
  echo "→ Создан .env из .env.production.example. Проверьте DOMAIN и ACME_EMAIL."
fi

# 1a. Переопределение домена/почты из окружения (используется автодеплоем из CI)
if [ -n "${DOMAIN:-}" ]; then
  if grep -qE '^DOMAIN=' .env; then sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env; else echo "DOMAIN=${DOMAIN}" >> .env; fi
fi
if [ -n "${ACME_EMAIL:-}" ]; then
  if grep -qE '^ACME_EMAIL=' .env; then sed -i "s|^ACME_EMAIL=.*|ACME_EMAIL=${ACME_EMAIL}|" .env; else echo "ACME_EMAIL=${ACME_EMAIL}" >> .env; fi
fi

# 2. Значения по умолчанию и автогенерация секретов
gen_secret() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }
set_default() {
  local key="$1" def="$2"
  grep -qE "^${key}=" .env || { echo "${key}=${def}" >> .env; echo "→ Добавлен ${key}=${def}"; }
}
ensure_secret() {
  local key="$1" cur
  if ! grep -qE "^${key}=" .env; then
    echo "${key}=$(gen_secret)" >> .env; echo "→ Сгенерирован ${key}."; return
  fi
  cur="$(grep -E "^${key}=" .env | head -1 | cut -d= -f2-)"
  case "$cur" in
    "" | CHANGE_ME*)
      sed -i "s|^${key}=.*|${key}=$(gen_secret)|" .env; echo "→ Сгенерирован ${key}." ;;
  esac
}
set_default DATABASE_URL "file:./razby.db"
set_default RAZBY_DEMO_MODE "false"
set_default RAZBY_EXECUTION_MODE "simulate"
set_default RAZBY_WORKER_ID "vps-worker-01"
# Порт, на который внешний front proxy VPS проксирует razby.ru (как у старого сайта).
set_default RAZBY_HOST_PORT "13001"
ensure_secret NEXTAUTH_SECRET
ensure_secret RAZBY_OWNER_ACCESS_CODE
ensure_secret RAZBY_ADMIN_TOKEN

DOMAIN="$(grep -E '^DOMAIN=' .env | head -1 | cut -d= -f2- || true)"
[ -n "$DOMAIN" ] || { echo "Заполните DOMAIN в .env" >&2; exit 1; }
RAZBY_HOST_PORT="$(grep -E '^RAZBY_HOST_PORT=' .env | head -1 | cut -d= -f2- || true)"
export DOMAIN RAZBY_HOST_PORT

# 3. Обновление кода
if [ "$NO_PULL" = false ] && [ -d .git ]; then
  echo "→ git pull…"
  git pull --ff-only || echo "  (git pull пропущен)"
fi

# 4. Резервная копия томов прежнего razby-сайта
echo "→ Резервная копия томов прежнего razby-сайта…"
mkdir -p backups
TS="$(date +%Y%m%d-%H%M%S)"
# Бэкапим тома прежнего razby-сайта (проекты razby / razby-prod)
for vol in $(docker volume ls -q 2>/dev/null | grep -E '^razby[-_]' || true); do
  echo "   • $vol"
  docker run --rm -v "$vol":/from -v "$ROOT/backups":/to alpine \
    tar czf "/to/${vol}-${TS}.tar.gz" -C /from . >/dev/null 2>&1 \
    && echo "     → backups/${vol}-${TS}.tar.gz" \
    || echo "     (пропущено: $vol)"
done

# 4a. Диагностика текущего состояния (видно в логах деплоя)
echo "→ Текущие контейнеры на сервере:"
docker ps --format '   {{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null || true
echo "→ Compose-проекты:"
docker compose ls --all 2>/dev/null || true

# 4b. Убрать временный проект razby-prod (артефакт прежних попыток деплоя).
#     Внешний front proxy (80/443) и другие сайты на VPS НЕ трогаем.
echo "→ Удаляю временный проект razby-prod (если есть)…"
docker compose -p razby-prod down --remove-orphans 2>/dev/null || true

# 5. Сборка и запуск. Проект называется razby (как у старого сайта), поэтому
#    up --remove-orphans заменяет старые контейнеры (web/api/postgres/redis) новым
#    web+worker на 127.0.0.1:${RAZBY_HOST_PORT}, не затрагивая front proxy.
echo "→ Сборка и запуск контейнеров…"
"${COMPOSE[@]}" up -d --build --remove-orphans

# 6. Ожидание готовности приложения
echo -n "→ Ожидание готовности приложения"
ready=false
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T web node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    ready=true; echo " — готово"; break
  fi
  echo -n "."; sleep 3
done
[ "$ready" = true ] || { echo; echo "Приложение не поднялось, смотрите логи: ${COMPOSE[*]} logs web" >&2; exit 1; }

# 7. Сидинг (по флагу)
if [ "$SEED" = true ]; then
  echo "→ Наполнение БД (seed)…"
  "${COMPOSE[@]}" exec -T web npm run db:seed
fi

echo
echo "✅ Готово. Приложение Razby слушает на 127.0.0.1:${RAZBY_HOST_PORT}."
echo "   Внешний front proxy VPS проксирует https://${DOMAIN} → 127.0.0.1:${RAZBY_HOST_PORT} (HTTPS на нём)."
"${COMPOSE[@]}" ps
