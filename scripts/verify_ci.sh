#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${PYTHON_BIN:=python3}"
: "${NODE_BIN:=node}"

command -v "$PYTHON_BIN" >/dev/null || { printf '%s\n' 'ERROR: Python is required.' >&2; exit 1; }
command -v "$NODE_BIN" >/dev/null || { printf '%s\n' 'ERROR: Node.js is required.' >&2; exit 1; }
command -v npm >/dev/null || { printf '%s\n' 'ERROR: npm is required.' >&2; exit 1; }

export APP_ENV=test
export PYTHONPATH="$ROOT_DIR/src"
export AUTH_TOKEN_SECRET="${AUTH_TOKEN_SECRET:-ci-only-not-a-secret}"

"$PYTHON_BIN" -m pip install --requirement requirements.txt
"$PYTHON_BIN" -m pytest tests/ -q
(
  cd src/frontend
  npm ci --ignore-scripts
  npm run lint
  npm test
  npm run build
)

if command -v ruff >/dev/null; then
  ruff check src tests scripts
else
  printf '%s\n' 'ERROR: ruff is required for the blocking static check.' >&2
  exit 1
fi

if command -v pip-audit >/dev/null; then
  pip-audit -r requirements.txt
else
  printf '%s\n' 'ERROR: pip-audit is required for the blocking dependency check.' >&2
  exit 1
fi

if command -v gitleaks >/dev/null; then
  gitleaks detect --no-banner --redact --source .
else
  printf '%s\n' 'ERROR: gitleaks is required for the blocking secret check.' >&2
  exit 1
fi

APP_ENV=staging \
DATABASE_URL=postgresql://ci:ci@localhost/ci \
PUBLIC_APP_URL=https://staging.example.invalid \
ALLOWED_HOSTS=staging.example.invalid \
ALLOWED_ORIGINS=https://staging.example.invalid \
SESSION_CSRF_SECRET=ci-only-placeholder-that-is-not-used \
SESSION_COOKIE_NAME=__Host-lookeate_session \
SESSION_COOKIE_SECURE=true \
ARTIFACT_COMMIT=ci \
ARTIFACT_BACKEND_DIGEST=sha256:ci \
ARTIFACT_FRONTEND_DIGEST=sha256:ci \
TELEMETRY_ENVIRONMENT=ci \
bash scripts/validate_deployed_config.sh

bash scripts/verify_postgresql_migrations.sh
