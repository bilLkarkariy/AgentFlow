#!/usr/bin/env bash
#
# Drives one canary deployment end to end, the way the 10-minute interview
# demo does it (docs/ops/demo-script.md).
#
#   scripts/demo-canary.sh sha-1a2b3c4              # a good build: promotes
#   scripts/demo-canary.sh sha-1a2b3c4 --chaos      # 30 % 5xx: aborts
#   scripts/demo-canary.sh sha-1a2b3c4 --dry-run    # print the sequence only
#
# The whole point is that this script never touches the cluster to deploy.
# It edits one line of YAML, commits, pushes, and then *watches*. Argo CD
# notices the commit, Argo Rollouts shifts traffic 10 % -> 50 % -> 100 %, and
# the Prometheus AnalysisRun decides whether that finishes or gets rolled
# back. The only `kubectl` writes here are a refresh annotation (impatience,
# not authority) and nothing else.
#
# What it does, in order:
#   1. preflight        rollouts plugin, current rollout state, dashboard URLs
#   2. loadgen          background traffic, killed on exit (no traffic = no
#                       analysis = a canary that passes without being measured)
#   3. yq               image.tag, and CHAOS_ERROR_RATE with --chaos
#   4. git              commit + push (this is the deploy)
#   5. argocd refresh   annotation, so the demo does not wait 3 min for polling
#   6. watch            `rollouts get -w` in front, AnalysisRun poller behind
#   7. on exit          final status, and the exact rollback commands if the
#                       rollout was aborted
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Every path below is relative to the repository root, so the printed commands
# are the commands a reader can paste.
cd "$REPO_ROOT"

DOMAIN="${DOMAIN:-127.0.0.1.sslip.io}"
NAMESPACE="${NAMESPACE:-agentflow}"
ARGOCD_NS="${ARGOCD_NS:-argocd}"
ROLLOUT="${ROLLOUT:-agentflow-api}"
APPLICATION="${APPLICATION:-agentflow-api}"
CHAOS_RATE="${CHAOS_RATE:-0.3}"
LOADGEN_DURATION="${LOADGEN_DURATION:-15m}"

TAG=""
ENV_NAME="local"
VALUES=""
LOAD_HOST=""
LOAD_URL=""
CHAOS=false
PUSH=true
DRY_RUN=false
LOADGEN=true

LOADGEN_PID=""
WATCHER_PID=""

if [[ -t 1 ]]; then
  RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; BLD=$'\033[1m'; DIM=$'\033[2m'; RST=$'\033[0m'
else
  RED=''; YEL=''; GRN=''; BLD=''; DIM=''; RST=''
fi

usage() {
  cat <<'EOF'
Usage: scripts/demo-canary.sh <image-tag> [options]

Deploys one image tag through the Argo Rollouts canary by committing to Git,
then watches the rollout and its AnalysisRun.

Arguments:
  <image-tag>          e.g. sha-1a2b3c4 (see the GHCR packages, or the tag
                       currently in deploy/envs/<env>/api.yaml)

Options:
  --chaos              also set config.CHAOS_ERROR_RATE=0.3, which makes the
                       api return 500 on ~30 % of non-health requests. The
                       istio-success-rate AnalysisRun fails and the rollout
                       is rolled back automatically. This is `make demo-break`.
  --env local|aws      which environment to deploy (default: local)
  --values <file>      values file to edit (default: deploy/envs/<env>/api.yaml)
  --no-push            commit but do not push (nothing will actually deploy)
  --no-loadgen         do not start background traffic
  --host <name>        Host header for the load generator
                       (default: the first VirtualService host in the values)
  --url <origin>       address the load generator dials
                       (default: http://127.0.0.1 locally)
  --dry-run            print every command, change nothing
  -h, --help           this text

Environment: DOMAIN, NAMESPACE, ARGOCD_NS, ROLLOUT, APPLICATION, CHAOS_RATE,
LOADGEN_DURATION.

Examples:
  scripts/demo-canary.sh sha-1a2b3c4
  scripts/demo-canary.sh sha-1a2b3c4 --chaos
  scripts/demo-canary.sh sha-1a2b3c4 --env aws --host api.1-2-3-4.sslip.io \
                         --url https://1-2-3-4.sslip.io
EOF
}

# --------------------------------------------------------------------------
# Arguments
# --------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --chaos)       CHAOS=true; shift ;;
    --env)         ENV_NAME="${2:?--env needs local or aws}"; shift 2 ;;
    --values)      VALUES="${2:?--values needs a path}"; shift 2 ;;
    --no-push)     PUSH=false; shift ;;
    --no-loadgen)  LOADGEN=false; shift ;;
    --host)        LOAD_HOST="${2:?--host needs a value}"; shift 2 ;;
    --url)         LOAD_URL="${2:?--url needs a value}"; shift 2 ;;
    --dry-run)     DRY_RUN=true; shift ;;
    -h|--help)     usage; exit 0 ;;
    -*)            printf 'demo-canary: unknown option %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
    *)
      if [[ -n "$TAG" ]]; then
        printf 'demo-canary: unexpected argument %s\n\n' "$1" >&2; usage >&2; exit 2
      fi
      TAG="$1"; shift ;;
  esac
done

if [[ -z "$TAG" ]]; then
  printf 'demo-canary: an image tag is required.\n\n' >&2
  usage >&2
  exit 2
fi

case "$ENV_NAME" in
  local|aws) ;;
  *) echo "demo-canary: --env must be local or aws (got '${ENV_NAME}')" >&2; exit 2 ;;
esac

[[ -n "$VALUES" ]] || VALUES="deploy/envs/${ENV_NAME}/api.yaml"
VALUES="${VALUES#"${REPO_ROOT}/"}"

step() { printf '\n%s== %s%s\n' "${BLD}" "$1" "${RST}"; }
info() { printf '   %s\n' "$*"; }
warn() { printf '   %s!%s %s\n' "$YEL" "$RST" "$*"; }

# shq <word...> : one shell-quoted line, so what is printed is what can be
# pasted. Plain words stay plain; anything with a space or a metacharacter
# gets single quotes.
shq() {
  local word out=""
  for word in "$@"; do
    if [[ "$word" =~ ^[A-Za-z0-9_@%+=:,./-]+$ ]]; then
      out+="${word} "
    else
      out+="'${word//\'/\'\\''}' "
    fi
  done
  printf '%s' "${out% }"
}

# run <command...> : echo it, then run it unless --dry-run.
run() {
  printf '   %s$ %s%s\n' "$DIM" "$(shq "$@")" "$RST"
  [[ "$DRY_RUN" == true ]] && return 0
  "$@"
}

# --------------------------------------------------------------------------
# Cleanup: the load generator and the AnalysisRun poller must never outlive
# the script, whether it ends normally, on Ctrl-C, or on an error.
# --------------------------------------------------------------------------
cleanup() {
  local code=$?
  set +e
  if [[ -n "$LOADGEN_PID" ]] && kill -0 "$LOADGEN_PID" 2>/dev/null; then
    kill "$LOADGEN_PID" 2>/dev/null
    wait "$LOADGEN_PID" 2>/dev/null
  fi
  if [[ -n "$WATCHER_PID" ]] && kill -0 "$WATCHER_PID" 2>/dev/null; then
    kill "$WATCHER_PID" 2>/dev/null
    wait "$WATCHER_PID" 2>/dev/null
  fi
  [[ "$DRY_RUN" == true ]] && exit "$code"
  final_report
  exit "$code"
}

final_report() {
  local status=""
  step "result"
  if command -v kubectl >/dev/null 2>&1; then
    status="$(kubectl -n "$NAMESPACE" get rollout "$ROLLOUT" \
      -o jsonpath='{.status.phase}' 2>/dev/null || true)"
    kubectl -n "$NAMESPACE" get rollout "$ROLLOUT" 2>/dev/null || true
    echo
    kubectl -n "$NAMESPACE" get analysisrun 2>/dev/null || true
  fi

  echo
  case "$status" in
    Healthy)
      printf '   %sRollout %s is Healthy: %s is now serving 100 %% of the traffic.%s\n' \
        "$GRN" "$ROLLOUT" "$TAG" "$RST"
      ;;
    Degraded|Paused|"")
      printf '   %sRollout %s is %s.%s\n' "$RED" "$ROLLOUT" "${status:-unknown}" "$RST"
      print_rollback
      ;;
    *)
      printf '   Rollout %s is %s.\n' "$ROLLOUT" "$status"
      print_rollback
      ;;
  esac
}

print_rollback() {
  cat <<EOF

   ${BLD}Rolling back is a Git operation, not a kubectl one.${RST}
   Argo Rollouts has already shifted traffic back to the stable version; the
   commit below is what makes the repository agree with the cluster again:

     git -C ${REPO_ROOT} revert --no-edit HEAD
     git -C ${REPO_ROOT} push
     kubectl -n ${ARGOCD_NS} annotate application ${APPLICATION} \\
       argocd.argoproj.io/refresh=normal --overwrite

   Do not use \`kubectl argo rollouts undo\`: it fixes the cluster and leaves
   Git describing a version nobody is running, so the next sync re-deploys
   the broken tag.
EOF
}

trap cleanup EXIT INT TERM

# --------------------------------------------------------------------------
# 1. Preflight
# --------------------------------------------------------------------------
step "preflight"

missing=0
for tool in git yq kubectl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf '   %sFAIL%s %s is required (see scripts/check-tools.sh)\n' "$RED" "$RST" "$tool"
    missing=1
  fi
done
[[ "$missing" -eq 0 ]] || exit 1

if [[ ! -f "$VALUES" ]]; then
  printf '   %sFAIL%s values file not found: %s\n' "$RED" "$RST" "$VALUES" >&2
  exit 1
fi
info "values      ${VALUES}"
info "environment ${ENV_NAME}"
info "image tag   ${TAG}"

if kubectl argo rollouts version >/dev/null 2>&1; then
  info "plugin      $(kubectl argo rollouts version 2>/dev/null | head -n1)"
else
  warn "kubectl-argo-rollouts is not installed: brew install argoproj/tap/kubectl-argo-rollouts"
  warn "the deploy still works, only the live view below will be missing"
fi

if [[ "$DRY_RUN" == false ]]; then
  info "current     $(kubectl argo rollouts status "$ROLLOUT" -n "$NAMESPACE" --timeout 5s 2>&1 | head -n1 || true)"
fi

# Where to look while it runs.
case "$ENV_NAME" in
  local)
    KIALI_URL="http://kiali.${DOMAIN}/console/graph/namespaces/?namespaces=${NAMESPACE}&graphType=versionedApp&duration=300&refresh=10000"
    GRAFANA_URL="http://grafana.${DOMAIN}/d/agentflow-canary"
    ROLLOUTS_URL="http://rollouts.${DOMAIN}/rollout/${NAMESPACE}/${ROLLOUT}"
    ;;
  aws)
    # Admin UIs are never exposed through the gateway on AWS: `make aws-ui`
    # opens the port-forwards below.
    # Ports are the ones scripts/aws-ui.sh forwards.
    KIALI_URL="http://localhost:20001/console/graph/namespaces/?namespaces=${NAMESPACE}&graphType=versionedApp&duration=300&refresh=10000"
    GRAFANA_URL="http://localhost:3001/d/agentflow-canary"
    ROLLOUTS_URL="http://localhost:3100/rollout/${NAMESPACE}/${ROLLOUT}"
    ;;
esac

echo
info "${BLD}Kiali${RST}    ${KIALI_URL}"
info "${BLD}Grafana${RST}  ${GRAFANA_URL}"
info "${BLD}Rollouts${RST} ${ROLLOUTS_URL}"
[[ "$ENV_NAME" == "aws" ]] && info "(run \`make aws-ui\` first: those three are port-forwards on AWS)"

# --------------------------------------------------------------------------
# 2. Background traffic
# --------------------------------------------------------------------------
step "traffic"

if [[ "$LOADGEN" == true ]]; then
  if [[ -z "$LOAD_HOST" ]]; then
    LOAD_HOST="$(yq -r '.istio.virtualService.hosts[0] // ""' "$VALUES")"
    [[ -n "$LOAD_HOST" && "$LOAD_HOST" != "null" ]] || LOAD_HOST="api.${DOMAIN}"
  fi
  if [[ "$LOAD_HOST" == *DOMAIN_PLACEHOLDER* ]]; then
    warn "the values file still says ${LOAD_HOST}: pass --host with the real EIP domain"
    warn "starting no traffic; the AnalysisRun will have nothing to measure"
    LOADGEN=false
  fi
fi

if [[ "$LOADGEN" == true ]]; then
  [[ -n "$LOAD_URL" ]] || LOAD_URL="http://127.0.0.1"
  LOADGEN_CMD=(scripts/loadgen.sh
    --host "$LOAD_HOST" --url "$LOAD_URL" --duration "$LOADGEN_DURATION")
  printf '   %s$ %s &%s\n' "$DIM" "$(shq "${LOADGEN_CMD[@]}")" "$RST"
  if [[ "$DRY_RUN" == false ]]; then
    "${LOADGEN_CMD[@]}" >/dev/null 2>&1 &
    LOADGEN_PID=$!
    info "load generator running in the background (pid ${LOADGEN_PID}), killed on exit"
  fi
else
  info "no load generator (--no-loadgen)"
  warn "with no traffic the success-rate query returns no series and \`or vector(1)\`"
  warn "makes the analysis pass: the canary will be promoted unmeasured"
fi

# --------------------------------------------------------------------------
# 3. Edit the desired state
# --------------------------------------------------------------------------
step "desired state"

export TAG
run yq -i '.image.tag = strenv(TAG)' "$VALUES"

if [[ "$CHAOS" == true ]]; then
  export CHAOS_RATE
  run yq -i '.config.CHAOS_ERROR_RATE = strenv(CHAOS_RATE)' "$VALUES"
  info "CHAOS_ERROR_RATE=${CHAOS_RATE}: ~$(awk -v r="$CHAOS_RATE" 'BEGIN{printf "%d", r*100}') % of non-health requests will return 500"
else
  run yq -i 'del(.config.CHAOS_ERROR_RATE)' "$VALUES"
fi

if [[ "$DRY_RUN" == false ]]; then
  echo
  git --no-pager diff -- "$VALUES" || true
fi

# --------------------------------------------------------------------------
# 4. Commit and push: this is the deploy
# --------------------------------------------------------------------------
step "deploy (git)"

COMMIT_MSG="deploy(api): ${TAG} [skip ci]"
[[ "$CHAOS" == true ]] && COMMIT_MSG="deploy(api): ${TAG} with chaos ${CHAOS_RATE} [skip ci]"

if [[ "$DRY_RUN" == false ]] && git diff --quiet -- "$VALUES"; then
  warn "no change to ${VALUES}: same tag, same config. Nothing to commit."
  warn "Argo CD will still be refreshed below, but no new revision will sync."
else
  run git add "$VALUES"
  run git commit -m "$COMMIT_MSG"
  if [[ "$PUSH" == true ]]; then
    run git push
  else
    warn "--no-push: the commit is local, Argo CD will not see it"
  fi
fi

# --------------------------------------------------------------------------
# 5. Ask Argo CD to look now
# --------------------------------------------------------------------------
step "argocd refresh"
info "the annotation only saves the 3-minute polling wait; it grants nothing"
run kubectl -n "$ARGOCD_NS" annotate application "$APPLICATION" \
  argocd.argoproj.io/refresh=normal --overwrite

if [[ "$DRY_RUN" == true ]]; then
  step "watch (not run: --dry-run)"
  printf '   %s$ kubectl get analysisrun -n %s        # background poller%s\n' "$DIM" "$NAMESPACE" "$RST"
  printf '   %s$ kubectl argo rollouts get rollout %s -n %s -w%s\n' "$DIM" "$ROLLOUT" "$NAMESPACE" "$RST"
  echo
  info "dry run complete: nothing was edited, committed, pushed or annotated."
  exit 0
fi

# --------------------------------------------------------------------------
# 6. Watch
# --------------------------------------------------------------------------
step "watching (Ctrl-C to stop)"

# AnalysisRun poller: `kubectl get -w` on AnalysisRun is noisy because every
# metric measurement is an update, so print only when the table changes.
watch_analysisruns() {
  local previous="" current
  while :; do
    current="$(kubectl -n "$NAMESPACE" get analysisrun \
      --no-headers 2>/dev/null | awk '{print $1, $2, $3}' || true)"
    if [[ -n "$current" && "$current" != "$previous" ]]; then
      printf '\n%s-- analysisrun @ %s --%s\n' "$DIM" "$(date +%H:%M:%S)" "$RST"
      printf '%s\n' "$current"
      previous="$current"
    fi
    sleep 10
  done
}

watch_analysisruns &
WATCHER_PID=$!

if command -v kubectl-argo-rollouts >/dev/null 2>&1; then
  kubectl argo rollouts get rollout "$ROLLOUT" -n "$NAMESPACE" -w || true
else
  # Fallback when the plugin is missing: plain kubectl, less pretty.
  kubectl -n "$NAMESPACE" get rollout "$ROLLOUT" -w || true
fi
