#!/usr/bin/env bash
#
# Seeds the local secret source read by External Secrets.
#
# Locally the ClusterSecretStore `agentflow` (WP9) uses the `kubernetes`
# provider and points at namespace `platform-secrets`. This script fills
# that namespace from the developer's own .env, so no credential is ever
# committed.
#
# The CA secret is NOT seeded: cert-manager generates the private CA
# in-cluster (deploy/platform/cert-manager/manifests). Only AWS pulls a CA
# from Secrets Manager.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="${NAMESPACE:-platform-secrets}"
SECRET_NAME="${SECRET_NAME:-agentflow-demo-app}"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"
CONTEXT="${KUBE_CONTEXT:-kind-agentflow-local}"

kube() { kubectl --context "$CONTEXT" "$@"; }

if ! kube version >/dev/null 2>&1; then
  echo "seed-local-secrets: cannot reach context '${CONTEXT}'." >&2
  echo "  kind export kubeconfig --name agentflow-local" >&2
  exit 1
fi

if ! kube get namespace "$NAMESPACE" >/dev/null 2>&1; then
  echo "seed-local-secrets: creating namespace ${NAMESPACE}"
  kube create namespace "$NAMESPACE"
  kube label namespace "$NAMESPACE" \
    app.kubernetes.io/part-of=agentflow-platform \
    agentflow.io/layer=security --overwrite
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
chmod 600 "$tmp"

if [[ -f "$ENV_FILE" ]]; then
  echo "seed-local-secrets: reading ${ENV_FILE}"
  # Keep only KEY=VALUE lines: comments, blanks and exports would break
  # --from-env-file.
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" > "$tmp" || true
  if [[ ! -s "$tmp" ]]; then
    echo "seed-local-secrets: ${ENV_FILE} has no KEY=VALUE line, falling back to a dummy key"
    printf 'OPENAI_API_KEY=changeme\n' > "$tmp"
  fi
else
  echo "seed-local-secrets: no ${ENV_FILE}, seeding a dummy OPENAI_API_KEY"
  echo "  agent runs will fail until you create .env from .env.example"
  printf 'OPENAI_API_KEY=changeme\n' > "$tmp"
fi

# `create --dry-run | apply` keeps the script idempotent and never prints
# the values.
kube create secret generic "$SECRET_NAME" \
  --namespace "$NAMESPACE" \
  --from-env-file="$tmp" \
  --dry-run=client -o yaml \
  | kube apply -f - >/dev/null

kube label secret "$SECRET_NAME" -n "$NAMESPACE" \
  app.kubernetes.io/part-of=agentflow-platform --overwrite >/dev/null

key_count="$(wc -l < "$tmp" | tr -d ' ')"
echo "seed-local-secrets: ${NAMESPACE}/${SECRET_NAME} has ${key_count} key(s)"
