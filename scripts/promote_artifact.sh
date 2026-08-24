#!/usr/bin/env bash
set -Eeuo pipefail

: "${MANIFEST:?MANIFEST must point to the staging-verified manifest}"
: "${PRODUCTION_BACKEND_DIGEST:?PRODUCTION_BACKEND_DIGEST is required}"
: "${PRODUCTION_FRONTEND_DIGEST:?PRODUCTION_FRONTEND_DIGEST is required}"
: "${CI_VERIFIED:?CI_VERIFIED=true is required}"
: "${STAGING_EVIDENCE_APPROVED:?STAGING_EVIDENCE_APPROVED=true is required}"

[[ "$CI_VERIFIED" == true ]] || { echo 'ERROR: required CI checks are not verified.' >&2; exit 1; }
[[ "$STAGING_EVIDENCE_APPROVED" == true ]] || { echo 'ERROR: staging security evidence is not approved.' >&2; exit 1; }

python3 - "$MANIFEST" "$PRODUCTION_BACKEND_DIGEST" "$PRODUCTION_FRONTEND_DIGEST" <<'PY'
import json
import sys

manifest = json.load(open(sys.argv[1], encoding="utf-8"))
expected = (manifest["artifacts"]["backend"]["digest"], manifest["artifacts"]["frontend"]["digest"])
actual = (sys.argv[2], sys.argv[3])
if expected != actual or any(value in {"", "pending-build"} for value in actual):
    raise SystemExit("ERROR: production digests do not match the staging-verified manifest")
print(json.dumps({"commit": manifest["commit"], "backend": actual[0], "frontend": actual[1]}))
PY
