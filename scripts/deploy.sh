#!/usr/bin/env bash
#
# Развёртывание razby.ru на VPS одной командой.
#   ./scripts/deploy.sh            — собрать и (пере)запустить стек
#   ./scripts/deploy.sh --seed     — то же + наполнить БД (первый запуск)
#   ./scripts/deploy.sh --no-pull  — не делать git pull
#
# Требования на сервере: Docker + docker compose, openssl, DNS razby.ru → этот сервер.
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
  sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env
fi
if [ -n "${ACME_EMAIL:-}" ]; then
  sed -i "s|^ACME_EMAIL=.*|ACME_EMAIL=${ACME_EMAIL}|" .env
fi

# 2. Автогенерация секретов вместо заглушек CHANGE_ME
gen_secret() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }
ensure_secret() {
  local key="$1" cur
  cur="$(grep -E "^${key}=" .env | cut -d= -f2- || true)"
  case "$cur" in
    "" | CHANGE_ME*)
      local val; val="$(gen_secret)"
      sed -i "s|^${key}=.*|${key}=${val}|" .env
      echo "→ Сгенерирован ${key}."
      ;;
  esac
}
ensure_secret POSTGRES_PASSWORD
ensure_secret JWT_ACCESS_SECRET
ensure_secret JWT_REFRESH_SECRET

DOMAIN="$(grep -E '^DOMAIN=' .env | cut -d= -f2- || true)"
ACME_EMAIL="$(grep -E '^ACME_EMAIL=' .env | cut -d= -f2- || true)"
[ -n "$DOMAIN" ] || { echo "Заполните DOMAIN в .env" >&2; exit 1; }
[ -n "$ACME_EMAIL" ] || { echo "Заполните ACME_EMAIL в .env" >&2; exit 1; }

# 3. Обновление кода
if [ "$NO_PULL" = false ] && [ -d .git ]; then
  echo "→ git pull…"
  git pull --ff-only || echo "  (git pull пропущен)"
fi

# 4. Сборка и запуск
echo "→ Сборка и запуск контейнеров…"
"${COMPOSE[@]}" up -d --build

# 5. Ожидание готовности API (миграции применяются при старте контейнера)
echo -n "→ Ожидание готовности API"
ready=false
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T api node -e \
    "require('http').get('http://localhost:4000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" \
    >/dev/null 2>&1; then
    ready=true; echo " — готово"; break
  fi
  echo -n "."; sleep 3
done
[ "$ready" = true ] || { echo; echo "API не поднялся, смотрите логи: ${COMPOSE[*]} logs api" >&2; exit 1; }

# 6. Сидинг (по флагу)
if [ "$SEED" = true ]; then
  echo "→ Наполнение БД (seed)…"
  "${COMPOSE[@]}" exec -T api node dist-seed/seed.js
fi

echo
echo "✅ Готово. Сайт: https://${DOMAIN}"
echo "   Caddy выпустит HTTPS-сертификат автоматически при первом запросе (DNS должен вести на сервер)."
"${COMPOSE[@]}" ps
