#!/usr/bin/env bash
#
# Opens the admin UIs of the EKS demo on localhost.
#
#   make aws-ui              # forwards, prints masked credentials
#   make aws-ui ARGS=--show  # same, credentials in clear
#   DRY_RUN=1 scripts/aws-ui.sh
#
# On AWS, only api / studio / dashboard get a public host. ArgoCD,
# Grafana, Kiali and the Rollouts dashboard are never published: no
# ingress, no TLS certificate, no authentication to get wrong, nothing to
# find by scanning the EIP. `kubectl port-forward` goes through the
# authenticated Kubernetes API instead, so access is exactly IAM plus RBAC.
#
# Ctrl-C stops every forward at once (the trap kills the whole group).
#
set -euo pipefail

LOG_TAG="aws-ui"
# shellcheck source=scripts/lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

SHOW_SECRETS=0
KCTX="$KUBE_CONTEXT_AWS"

# name | namespace | service | local port | remote port
FORWARDS=(
  "ArgoCD|argocd|argocd-server|8080|80"
  "Grafana|observability|kube-prometheus-stack-grafana|3001|80"
  "Kiali|istio-system|kiali|20001|20001"
  "Rollouts|argo-rollouts|argo-rollouts-dashboard|3100|3100"
)

usage() {
  cat <<'EOF'
Usage: scripts/aws-ui.sh [--show] [--dry-run]

  --show      print the passwords in clear instead of masking them
  --dry-run   print the commands instead of running them

Forwards (all on 127.0.0.1):
  8080  ArgoCD      argocd/argocd-server
  3001  Grafana     observability/kube-prometheus-stack-grafana
  20001 Kiali       istio-system/kiali
  3100  Rollouts    argo-rollouts/argo-rollouts-dashboard
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --show) SHOW_SECRETS=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "unknown argument: $1"; usage >&2; exit 2 ;;
  esac
done

need_cmd kubectl aws jq
need_cmd_report || exit 1

mask() {
  local value="$1"
  if [[ "$SHOW_SECRETS" == "1" ]]; then
    printf '%s' "$value"
  elif [[ -z "$value" ]]; then
    printf '%s' "(not available)"
  else
    printf '%s' "******** (re-run with --show)"
  fi
}

########################################################################
# Credentials
########################################################################
argocd_password() {
  [[ "$DRY_RUN" == "1" ]] && { printf '<argocd-initial-admin-secret>'; return; }
  kubectl --context "$KCTX" -n argocd get secret argocd-initial-admin-secret \
    -o jsonpath='{.data.password}' 2>/dev/null | base64 --decode 2>/dev/null || true
}

grafana_password() {
  [[ "$DRY_RUN" == "1" ]] && { printf '<agentflow/demo/grafana>'; return; }
  # Read it from the source of truth rather than from the Kubernetes
  # Secret: the ExternalSecret only mirrors what Secrets Manager holds.
  aws secretsmanager get-secret-value --secret-id agentflow/demo/grafana \
    --query SecretString --output text 2>/dev/null \
    | jq -r '."admin-password" // empty' 2>/dev/null || true
}

grafana_user() {
  [[ "$DRY_RUN" == "1" ]] && { printf 'admin'; return; }
  aws secretsmanager get-secret-value --secret-id agentflow/demo/grafana \
    --query SecretString --output text 2>/dev/null \
    | jq -r '."admin-user" // "admin"' 2>/dev/null || printf 'admin'
}

########################################################################
# Forwards
########################################################################
PIDS=()
LOGDIR="$(mktemp -d -t agentflow-ui)"

cleanup() {
  local pid
  printf '\n'
  for pid in "${PIDS[@]:-}"; do
    [[ -n "$pid" ]] && kill "$pid" >/dev/null 2>&1 || true
  done
  wait >/dev/null 2>&1 || true
  log "all port-forwards stopped"
  rm -rf "$LOGDIR"
}
trap cleanup EXIT INT TERM

if [[ "$DRY_RUN" != "1" ]] && ! kubectl --context "$KCTX" cluster-info >/dev/null 2>&1; then
  err "context '${KCTX}' does not answer"
  die "run \`make aws-kubeconfig\` (or \`make aws-up\`) first"
fi

banner "admin UIs on localhost"

for entry in "${FORWARDS[@]}"; do
  IFS='|' read -r name ns svc lport rport <<< "$entry"

  if [[ "$DRY_RUN" == "1" ]]; then
    run kubectl --context "$KCTX" -n "$ns" port-forward "svc/${svc}" "${lport}:${rport}"
    continue
  fi

  if ! kubectl --context "$KCTX" -n "$ns" get "svc/${svc}" >/dev/null 2>&1; then
    warn "${name}: no Service ${ns}/${svc}, skipping (is that component enabled?)"
    continue
  fi

  kubectl --context "$KCTX" -n "$ns" port-forward "svc/${svc}" "${lport}:${rport}" \
    > "${LOGDIR}/${name}.log" 2>&1 &
  PIDS+=("$!")
  ok "$(printf '%-10s http://localhost:%s' "$name" "$lport")"
done

if [[ "$DRY_RUN" == "1" ]]; then
  log "would print the ArgoCD and Grafana credentials, then wait for Ctrl-C"
  exit 0
fi

# A forward that dies immediately (wrong port, RBAC) should be visible
# now, not in ten minutes.
sleep 2
for pid in "${PIDS[@]:-}"; do
  if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
    warn "a port-forward exited straight away; its log is in ${LOGDIR}"
  fi
done

cat <<EOF

  ArgoCD      http://localhost:8080     admin / $(mask "$(argocd_password)")
  Grafana     http://localhost:3001     $(grafana_user) / $(mask "$(grafana_password)")
  Kiali       http://localhost:20001    no login (read-only viewer)
  Rollouts    http://localhost:3100     no login

  The passwords come from the cluster (argocd-initial-admin-secret) and
  from Secrets Manager (agentflow/demo/grafana). Neither is in Git.

  Ctrl-C stops every forward.

EOF

wait
