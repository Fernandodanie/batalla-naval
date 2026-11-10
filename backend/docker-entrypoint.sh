#!/bin/sh
# Prepara la base de datos y arranca el servidor.
set -e

if [ -n "$DATABASE_URL" ] && [ "$STORAGE" != "memory" ]; then
  if [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    echo "[entrypoint] Aplicando migraciones versionadas (prisma migrate deploy)..."
    if ! npx prisma migrate deploy; then
      # Una base creada con 'db push' (v0.5 o anterior) ya tiene las tablas iniciales pero no el historial: se marca la
      # migración 0_init como aplicada y se reintenta, para que solo se apliquen las nuevas (campañas y logros).
      echo "[entrypoint] Falló migrate deploy. Si la base venía de 'db push', marco 0_init como aplicada y reintento..."
      npx prisma migrate resolve --applied 0_init && npx prisma migrate deploy || { echo "[entrypoint] No se pudieron aplicar las migraciones."; exit 1; }
    fi
  else
    echo "[entrypoint] No hay carpeta prisma/migrations: sincronizo el esquema con 'prisma db push'."
    echo "[entrypoint] (Valido para la demo. Para producción crea migraciones: ver README.)"
    npx prisma db push --skip-generate
  fi
fi

exec "$@"
