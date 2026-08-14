#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd -- "$script_dir/.." && pwd)"
compose_file="$root_dir/docker-compose.migrations-test.yml"
project="lookeate-migrations-$$"
python_bin="${PYTHON_BIN:-python}"
cleanup_required=false

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    local status=$?
    trap - EXIT

    if [[ "$cleanup_required" == true ]]; then
        if ! docker compose -f "$compose_file" -p "$project" down --volumes --remove-orphans; then
            printf 'ERROR: Disposable PostgreSQL cleanup failed for Compose project %s.\n' "$project" >&2
            status=1
        fi
    fi

    exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[[ -d "$root_dir" ]] || die "Repository root was not found."
[[ -f "$compose_file" ]] || die "PostgreSQL verification Compose file was not found."
command -v docker >/dev/null 2>&1 || die "Docker is unavailable. Install or start Docker and retry."
docker version >/dev/null 2>&1 || die "Docker is unavailable. Start Docker Desktop or the Docker daemon and retry."
docker compose version >/dev/null 2>&1 || die "Docker Compose is unavailable. Install the Docker Compose plugin and retry."
command -v "$python_bin" >/dev/null 2>&1 || die "Python executable '$python_bin' was not found. Activate the project environment or set PYTHON_BIN."

cleanup_required=true
docker compose -f "$compose_file" -p "$project" up -d --wait \
    || die "Disposable PostgreSQL failed to become healthy."

binding="$(docker compose -f "$compose_file" -p "$project" port postgres 5432)" \
    || die "Could not resolve the disposable PostgreSQL port."
binding="${binding//$'\r'/}"
port="${binding##*:}"
[[ "$port" =~ ^[0-9]+$ ]] || die "Docker returned an invalid PostgreSQL port binding."

cd -- "$root_dir"
POSTGRES_TEST_DATABASE_URL="postgresql+psycopg://lookeate_test:disposable_test_password@127.0.0.1:${port}/lookeate_migrations" \
PYTHONPATH="src" \
APP_ENV="test" \
AUTH_TOKEN_SECRET="test-only-auth-secret" \
"$python_bin" -m pytest verification/test_schema_migrations_postgresql.py -q
