#!/usr/bin/env bash
#
# Сервисные операции razby.ru на сервере. Запускается workflow «Maintenance»
# (.github/workflows/maintenance.yml) или вручную: ./scripts/maintenance.sh <task> [confirm]
#
# Задачи:
#   status           — состояние контейнеров, сайтов nginx, диска
#   logs-api         — последние логи API
#   migrate          — применить миграции Prisma
#   seed             — наполнить БД
#   restart          — перезапустить контейнеры razby
#   backup-db        — дамп БД razby в backups/
#   cleanup-bankrot  — удалить приложение bankrot (контейнеры+тома)   [нужен confirm=DELETE]
#   cleanup-sites    — отключить nginx-сайты mystica и taroday        [нужен confirm=DELETE]
#   cleanup-pm2      — удалить старый PM2-процесс razby-site          [нужен confirm=DELETE]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
COMPOSE=(docker compose -f infra/docker-compose.server.yml --env-file "$ROOT/.env")

TASK="${1:-status}"
CONFIRM="${2:-}"

need_confirm() { [ "$CONFIRM" = "DELETE" ] || { echo "Задача '$TASK' удаляющая — повторите с confirm=DELETE"; exit 1; }; }

case "$TASK" in
  status)
    echo "== Контейнеры =="; "${COMPOSE[@]}" ps
    echo; echo "== nginx сайты =="; ls -1 /etc/nginx/sites-enabled/ 2>/dev/null || true
    echo; echo "== Диск =="; df -h / | tail -1
    ;;
  logs-api)
    "${COMPOSE[@]}" logs --tail 100 api
    ;;
  migrate)
    "${COMPOSE[@]}" exec -T api pnpm exec prisma migrate deploy
    ;;
  seed)
    "${COMPOSE[@]}" exec -T api node dist-seed/seed.js
    ;;
  restart)
    "${COMPOSE[@]}" restart
    "${COMPOSE[@]}" ps
    ;;
  backup-db)
    mkdir -p backups
    f="backups/razby-$(date +%F-%H%M%S).sql.gz"
    "${COMPOSE[@]}" exec -T postgres pg_dump -U "${POSTGRES_USER:-razby}" "${POSTGRES_DB:-razby}" | gzip > "$f"
    echo "Бэкап сохранён: $f ($(du -h "$f" | cut -f1))"
    ;;
  cleanup-bankrot)
    need_confirm
    docker rm -f bankrot-frontend-1 bankrot-backend-1 bankrot-celery-1 bankrot-celery-beat-1 \
      bankrot-redis-1 bankrot-postgres-1 bankrot-minio-1 bankrot-nginx-1 2>/dev/null || true
    docker volume rm bankrot_postgres_data bankrot_minio_data bankrot_redis_data 2>/dev/null || true
    echo "bankrot удалён."; docker ps --format '{{.Names}}'
    ;;
  cleanup-sites)
    need_confirm
    rm -f /etc/nginx/sites-enabled/mystica /etc/nginx/sites-enabled/taroday.conf
    nginx -t && systemctl reload nginx
    echo "Лишние сайты отключены."; ls -1 /etc/nginx/sites-enabled/
    ;;
  cleanup-pm2)
    need_confirm
    pm2 delete razby-site && pm2 save
    echo "PM2 razby-site удалён."
    ;;
  *)
    echo "Неизвестная задача: $TASK" >&2; exit 1 ;;
esac
