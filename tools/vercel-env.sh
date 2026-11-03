#!/bin/sh
# Заливає змінні з .env у Vercel-проєкт (production + preview). Потрібен залогінений Vercel CLI і зв'язаний проєкт.
#   sh tools/vercel-env.sh            # з .env
#   sh tools/vercel-env.sh .env.prod  # з іншого файлу
set -e
FILE="${1:-.env}"
[ -f "$FILE" ] || { echo "немає файлу $FILE"; exit 1; }
grep -E '^[A-Z0-9_]+=' "$FILE" | while IFS='=' read -r KEY VALUE; do
  case "$KEY" in KV_REST_API_URL|KV_REST_API_TOKEN) continue;; esac   # їх додає інтеграція Upstash
  [ -z "$VALUE" ] && continue
  for ENVIRONMENT in production preview; do
    printf '%s' "$VALUE" | npx vercel env add "$KEY" "$ENVIRONMENT" --force >/dev/null 2>&1 \
      && echo "  $KEY -> $ENVIRONMENT" || echo "  ! $KEY -> $ENVIRONMENT (помилка)"
  done
done
