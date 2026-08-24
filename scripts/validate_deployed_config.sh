#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_ENV:?APP_ENV is required}"
case "$APP_ENV" in staging|production) ;; *) exit 0 ;; esac

required=(DATABASE_URL PUBLIC_APP_URL ALLOWED_HOSTS ALLOWED_ORIGINS SESSION_CSRF_SECRET SESSION_COOKIE_NAME ARTIFACT_COMMIT ARTIFACT_BACKEND_DIGEST ARTIFACT_FRONTEND_DIGEST TELEMETRY_ENVIRONMENT)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { printf 'ERROR: %s is required in %s.\n' "$name" "$APP_ENV" >&2; exit 1; }
done
[[ "$DATABASE_URL" == postgresql* ]] || { echo 'ERROR: deployed DATABASE_URL must use PostgreSQL.' >&2; exit 1; }
[[ "${SESSION_COOKIE_SECURE:-false}" == true ]] || { echo 'ERROR: deployed session cookies must be secure.' >&2; exit 1; }
[[ "$SESSION_COOKIE_NAME" == __Host-* ]] || { echo 'ERROR: deployed session cookie must use __Host-.' >&2; exit 1; }
