#!/usr/bin/env bash
# Build the four AgentFlow images locally and load them into the kind cluster,
# tagged exactly like CI does (ghcr.io/<owner>/agentflow-<svc>:sha-<short>).
# Lets a fresh cluster start the apps before GHCR has the images (or offline).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.orbstack/bin:$PATH"
OWNER="${IMAGE_OWNER:-billkarkariy}"
TAG="${TAG:-sha-$(git -C "$REPO_ROOT" rev-parse --short=7 HEAD)}"
CLUSTER="${KIND_CLUSTER:-agentflow-local}"
SERVICES="${SERVICES:-api worker studio dashboard}"
LOAD="${LOAD:-1}"

for svc in $SERVICES; do
  case "$svc" in
    api)       ctx="$REPO_ROOT";        df="$REPO_ROOT/api/Dockerfile" ;;
    worker)    ctx="$REPO_ROOT/worker"; df="$REPO_ROOT/worker/Dockerfile" ;;
    studio)    ctx="$REPO_ROOT";        df="$REPO_ROOT/web/studio/Dockerfile" ;;
    dashboard) ctx="$REPO_ROOT";        df="$REPO_ROOT/web/dashboard/Dockerfile" ;;
    *) echo "unknown service: $svc" >&2; exit 1 ;;
  esac
  image="ghcr.io/${OWNER}/agentflow-${svc}:${TAG}"
  echo "==> building ${image}"
  docker build -q -f "$df" -t "$image" "$ctx" >/dev/null
  if [ "$LOAD" = "1" ]; then
    echo "==> loading into kind/${CLUSTER}"
    kind load docker-image --name "$CLUSTER" "$image"
  fi
done
echo "done: tag ${TAG}"
