#!/usr/bin/env bash
#
# Verifies the security layer of the platform (WP9).
#
#   scripts/verify-security.sh          offline checks, then live ones if
#                                       a cluster is reachable
#   scripts/verify-security.sh --offline   never touch a cluster (CI)
#
# Offline (always):
#   1. kyverno test        - the policy regression suite
#   2. kustomize + kubeconform on every overlay this WP owns
#   3. kubeconform on the NetworkPolicies
#
# Live (only when `kubectl cluster-info` answers):
#   4. an offending pod is rejected at admission (nginx:latest, root,
#      no limits) - the three Enforce policies, proven end to end
#   5. every ExternalSecret reports SecretSynced
#   6. a pod outside the mesh cannot call the api - mTLS STRICT
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTEXT="${KUBE_CONTEXT:-kind-agentflow-local}"
APP_NS="${APP_NS:-agentflow}"
PROBE_NS="${PROBE_NS:-default}"
OFFLINE=0
FAILURES=0

CRD_SCHEMAS='https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json'

if [[ -t 1 ]]; then
  RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; DIM=$'\033[2m'; RST=$'\033[0m'
else
  RED=''; YEL=''; GRN=''; DIM=''; RST=''
fi

for arg in "$@"; do
  case "$arg" in
    --offline) OFFLINE=1 ;;
    -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "verify-security: unknown argument '${arg}'" >&2; exit 2 ;;
  esac
done

step()  { printf '\n%s== %s%s\n' "$DIM" "$1" "$RST"; }
ok()    { printf '  %s[ok]%s   %s\n' "$GRN" "$RST" "$1"; }
warn()  { printf '  %s[skip]%s %s\n' "$YEL" "$RST" "$1"; }
fail()  { printf '  %s[FAIL]%s %s\n' "$RED" "$RST" "$1"; FAILURES=$((FAILURES + 1)); }

need() {
  # need <binary> <what it is used for>
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing tool '$1' (needed for $2) - see scripts/check-tools.sh"
    return 1
  fi
  return 0
}

conform() {
  # conform <label> <file>...
  # Never called through a pipe: `fail` has to increment FAILURES in this
  # shell, not in a subshell of a pipeline.
  local label="$1"; shift
  if kubeconform -strict -summary \
      -skip CustomResourceDefinition \
      -schema-location default \
      -schema-location "$CRD_SCHEMAS" \
      "$@"; then
    ok "$label"
  else
    fail "$label"
  fi
}

kube() { kubectl --context "$CONTEXT" "$@"; }

########################################################################
# 1. Kyverno policy tests
########################################################################
step "Kyverno policy tests"
if need kyverno "the policy test suite"; then
  if kyverno test "${REPO_ROOT}/deploy/platform/kyverno/tests" >/tmp/kyverno-test.out 2>&1; then
    ok "$(grep -E 'Test Summary' /tmp/kyverno-test.out | tail -1)"
  else
    fail "kyverno test failed"
    sed 's/^/    /' /tmp/kyverno-test.out
  fi
fi

########################################################################
# 2. Rendered manifests are valid Kubernetes objects
########################################################################
step "Manifest validation"
if need kustomize "building the overlays" && need kubeconform "schema validation"; then
  for overlay in \
    deploy/platform/kyverno/policies/overlays/local \
    deploy/platform/kyverno/policies/overlays/aws \
    deploy/platform/external-secrets/manifests/overlays/local \
    deploy/platform/external-secrets/manifests/overlays/aws
  do
    if ! kustomize build "${REPO_ROOT}/${overlay}" >/tmp/verify-security-build.yaml 2>/tmp/verify-security-build.err; then
      fail "kustomize build ${overlay}"
      sed 's/^/    /' /tmp/verify-security-build.err
      continue
    fi
    conform "$overlay" /tmp/verify-security-build.yaml
  done

  step "NetworkPolicies"
  conform "network-policies" "${REPO_ROOT}"/deploy/platform/network-policies/manifests/*.yaml
fi

########################################################################
# 3. Live checks
########################################################################
if [[ "$OFFLINE" -eq 1 ]]; then
  step "Live checks"
  warn "--offline requested"
elif ! kube cluster-info >/dev/null 2>&1; then
  step "Live checks"
  warn "no cluster on context '${CONTEXT}' (make local-up first)"
else
  ####################################################################
  # 3a. Admission control
  ####################################################################
  step "Admission control (namespace ${APP_NS})"

  expect_denied() {
    # expect_denied <name> <policy it should trip> <kubectl args...>
    local name="$1" policy="$2"; shift 2
    local out
    if out="$("$@" 2>&1)"; then
      fail "${name}: admitted, expected a denial from ${policy}"
    elif grep -qi "${policy}" <<<"$out"; then
      ok "${name}: denied by ${policy}"
    else
      fail "${name}: denied, but not by ${policy}"
      printf '    %s\n' "$out" | head -5
    fi
  }

  expect_denied "nginx:latest" "disallow-latest-tag" \
    kube run kyverno-probe-latest --image=nginx:latest \
      -n "$APP_NS" --restart=Never --dry-run=server -o name

  expect_denied "no resource limits" "require-resource-limits" \
    kube run kyverno-probe-limits --image=nginx:1.29 \
      -n "$APP_NS" --restart=Never --dry-run=server -o name \
      --overrides='{"spec":{"securityContext":{"runAsNonRoot":true}}}'

  expect_denied "runs as root" "require-run-as-nonroot" \
    kube run kyverno-probe-root --image=nginx:1.29 \
      -n "$APP_NS" --restart=Never --dry-run=server -o name \
      --overrides='{"spec":{"containers":[{"name":"kyverno-probe-root","image":"nginx:1.29","resources":{"limits":{"memory":"64Mi"},"requests":{"cpu":"10m"}}}]}}'

  ####################################################################
  # 3b. External Secrets
  ####################################################################
  step "External Secrets"
  if ! need jq "reading ExternalSecret conditions"; then
    es_json='{}'
  else
    es_json="$(kube get externalsecrets.external-secrets.io -A -o json 2>/dev/null || echo '{}')"
  fi
  es_total="$(jq -r '(.items // []) | length' <<<"$es_json" 2>/dev/null || echo 0)"
  if [[ "$es_total" -eq 0 ]]; then
    warn "no ExternalSecret found (profile 'minimal', or wave 16 not synced yet)"
  else
    while IFS=$'\t' read -r ns name reason; do
      [[ -n "$name" ]] || continue
      if [[ "$reason" == "SecretSynced" ]]; then
        ok "${ns}/${name}: ${reason}"
      else
        fail "${ns}/${name}: ${reason:-<no Ready condition>}"
      fi
    done < <(jq -r '
      (.items // [])[]
      | [ .metadata.namespace,
          .metadata.name,
          ((.status.conditions // []) | map(select(.type == "Ready")) | .[0].reason // "") ]
      | @tsv' <<<"$es_json")
  fi

  ####################################################################
  # 3c. mTLS STRICT
  ####################################################################
  step "mTLS STRICT (PeerAuthentication)"
  if ! kube -n "$APP_NS" get svc agentflow-api >/dev/null 2>&1; then
    warn "service ${APP_NS}/agentflow-api not deployed yet"
  else
    # `default` has no sidecar injection, so this pod speaks plain HTTP to
    # a workload that only accepts mTLS. Envoy resets the connection ->
    # curl exit 52/56, never a 200.
    probe_out="$(kube run mtls-probe -n "$PROBE_NS" \
      --image=curlimages/curl:8.11.1 --restart=Never --rm -i --quiet \
      --command -- curl -sS --max-time 8 -o /dev/null \
        -w '%{http_code}' "http://agentflow-api.${APP_NS}/health" 2>&1 || true)"
    if grep -qE '(^|[^0-9])200([^0-9]|$)' <<<"$probe_out"; then
      fail "un-meshed pod got 200 from agentflow-api - STRICT mTLS is not in effect"
    else
      ok "un-meshed pod refused (${probe_out//$'\n'/ })"
    fi
    kube -n "$PROBE_NS" delete pod mtls-probe --ignore-not-found >/dev/null 2>&1 || true
  fi
fi

########################################################################
printf '\n'
if [[ "$FAILURES" -eq 0 ]]; then
  printf '%sverify-security: all checks passed.%s\n' "$GRN" "$RST"
  exit 0
fi
printf '%sverify-security: %d check(s) failed.%s\n' "$RED" "$FAILURES" "$RST"
exit 1
