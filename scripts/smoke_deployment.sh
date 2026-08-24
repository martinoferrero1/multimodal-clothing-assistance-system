#!/usr/bin/env bash
set -Eeuo pipefail

: "${API_BASE_URL:?API_BASE_URL is required}"
: "${FRONTEND_BASE_URL:?FRONTEND_BASE_URL is required}"
: "${ARTIFACT_DIGEST:?ARTIFACT_DIGEST is required}"
: "${EVIDENCE_FILE:=artifacts/smoke-${ARTIFACT_DIGEST}.json}"

mkdir -p "$(dirname "$EVIDENCE_FILE")"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

curl --fail --silent --show-error --max-time 10 -D "$tmp" "$API_BASE_URL/live" -o /dev/null
grep -qi '^x-request-id:' "$tmp" || { echo 'ERROR: liveness response lacks x-request-id' >&2; exit 1; }
curl --fail --silent --show-error --max-time 10 "$API_BASE_URL/ready" >/dev/null
curl --fail --silent --show-error --max-time 10 -D "$tmp" "$FRONTEND_BASE_URL/" -o /dev/null
grep -qi '^x-content-type-options: nosniff' "$tmp" || { echo 'ERROR: frontend security header missing' >&2; exit 1; }
grep -Eiq '^content-security-policy(-report-only)?:' "$tmp" || { echo 'ERROR: CSP header missing' >&2; exit 1; }
curl --fail --silent --show-error --max-time 10 "$FRONTEND_BASE_URL/style" -o /dev/null
curl --silent --show-error --max-time 10 -o /dev/null -w '%{http_code}' "$API_BASE_URL/auth/me" | grep -Eq '^(200|401|403)$' || {
  echo 'ERROR: authentication-safe probe returned an unexpected status.' >&2
  exit 1
}

python3 - "$EVIDENCE_FILE" "$ARTIFACT_DIGEST" "$tmp" <<'PY'
import json
import sys
from datetime import datetime, timezone
headers = {}
for line in open(sys.argv[3], encoding="utf-8", errors="replace"):
    if ":" in line:
        name, value = line.split(":", 1)
        if name.lower() in {"content-security-policy", "content-security-policy-report-only", "strict-transport-security", "x-content-type-options"}:
            headers[name.lower()] = value.strip()
with open(sys.argv[1], "w", encoding="utf-8") as output:
    json.dump({"artifact_digest": sys.argv[2], "checked_at": datetime.now(timezone.utc).isoformat(), "status": "passed", "security_headers": headers, "credentials_included": False}, output, indent=2)
    output.write("\n")
PY
