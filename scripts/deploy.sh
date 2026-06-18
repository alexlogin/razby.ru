#!/usr/bin/env bash
#
# Развёртывание razby.ru ЗА существующим системным nginx (сервер 89.111.131.180).
# Поднимает контейнеры на 127.0.0.1 и настраивает блок nginx только для razby.ru,
# не трогая другие сайты сервера (mystica, riverhod, taroday) и приложение bankrot.
#
#   ./scripts/deploy.sh            — собрать и (пере)запустить
#   ./scripts/deploy.sh --seed     — то же + наполнить БД (первый запуск)
#   ./scripts/deploy.sh --no-pull  — не делать git pull
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
COMPOSE=(docker compose -f infra/docker-compose.server.yml --env-file "$ROOT/.env")

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
  echo "→ Создан .env из .env.production.example."
fi
[ -n "${DOMAIN:-}" ] && sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env

# 2. Автогенерация секретов вместо заглушек CHANGE_ME
gen_secret() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }
ensure_secret() {
  local key="$1" cur
  cur="$(grep -E "^${key}=" .env | cut -d= -f2- || true)"
  case "$cur" in
    "" | CHANGE_ME*)
      sed -i "s|^${key}=.*|${key}=$(gen_secret)|" .env
      echo "→ Сгенерирован ${key}." ;;
  esac
}
ensure_secret POSTGRES_PASSWORD
ensure_secret JWT_ACCESS_SECRET
ensure_secret JWT_REFRESH_SECRET

# 3. git pull
if [ "$NO_PULL" = false ] && [ -d .git ]; then
  echo "→ git pull…"; git pull --ff-only || echo "  (git pull пропущен)"
fi

# 4. Убрать прошлую неудачную попытку (Caddy-проект), если была
docker compose -p razby-prod down --remove-orphans >/dev/null 2>&1 || true

# 5. Сборка и запуск контейнеров (на 127.0.0.1)
echo "→ Сборка и запуск контейнеров…"
"${COMPOSE[@]}" up -d --build

# 6. Ожидание готовности API
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
[ "$ready" = true ] || { echo; echo "API не поднялся, логи: ${COMPOSE[*]} logs api" >&2; exit 1; }

# 7. Настройка nginx для razby.ru (только этот сайт)
if command -v nginx >/dev/null 2>&1; then
  echo "→ Настройка nginx для razby.ru…"
  DEST=/etc/nginx/sites-available/razby.ru
  if [ -f "$DEST" ]; then
    cp "$DEST" "${DEST}.before-razby-platform.$(date +%Y%m%d-%H%M%S)"
  fi
  cp infra/nginx/razby.ru.conf "$DEST"
  ln -sf "$DEST" /etc/nginx/sites-enabled/razby.ru
  if nginx -t >/tmp/nginx-test.log 2>&1; then
    systemctl reload nginx
    echo "  nginx перезагружен."
  else
    echo "  ОШИБКА в конфиге nginx — откатываю:"; cat /tmp/nginx-test.log >&2
    BK="$(ls -t ${DEST}.before-razby-platform.* 2>/dev/null | head -1 || true)"
    [ -n "$BK" ] && cp "$BK" "$DEST" && systemctl reload nginx || true
    exit 1
  fi
else
  echo "→ nginx не найден на сервере — пропускаю настройку прокси."
fi

# 8. Сидинг (по флагу)
if [ "$SEED" = true ]; then
  echo "→ Наполнение БД (seed)…"
  "${COMPOSE[@]}" exec -T api node dist-seed/seed.js
fi

echo
echo "✅ Готово. Сайт: https://${DOMAIN:-razby.ru}"
"${COMPOSE[@]}" ps
