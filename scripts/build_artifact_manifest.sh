#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
: "${ARTIFACT_DIR:=$ROOT_DIR/artifacts}"
: "${COMMIT_SHA:=$(git rev-parse HEAD)}"
: "${IMAGE_REGISTRY:=local}"

mkdir -p "$ARTIFACT_DIR"
backend_digest="${BACKEND_DIGEST:-pending-build}"
frontend_digest="${FRONTEND_DIGEST:-pending-build}"
python_version="$(python3 --version 2>/dev/null | sed 's/[^0-9.]*//')"
node_version="$(node --version 2>/dev/null | sed 's/^v//')"

ARTIFACT_DIR="$ARTIFACT_DIR" COMMIT_SHA="$COMMIT_SHA" IMAGE_REGISTRY="$IMAGE_REGISTRY" \
BACKEND_DIGEST="$backend_digest" FRONTEND_DIGEST="$frontend_digest" \
PYTHON_VERSION="$python_version" NODE_VERSION="$node_version" \
python3 - <<'PY'
import json
import os
from pathlib import Path

manifest = {
    "schema": "lookeate.artifact-manifest.v1",
    "commit": os.environ["COMMIT_SHA"],
    "registry": os.environ["IMAGE_REGISTRY"],
    "artifacts": {
        "backend": {"digest": os.environ["BACKEND_DIGEST"]},
        "frontend": {"digest": os.environ["FRONTEND_DIGEST"]},
    },
    "tooling": {"python": os.environ["PYTHON_VERSION"], "node": os.environ["NODE_VERSION"]},
}
Path(os.environ["ARTIFACT_DIR"]).joinpath(f"manifest-{manifest['commit']}.json").write_text(
    json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
)
PY
