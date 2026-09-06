#!/usr/bin/env bash
#
# Preflight for `make local-up`.
#
# Prints one line per tool (name, brew formula, version), then checks the
# container runtime, the VM size, the host ports and the /etc/hosts entry.
# Exits 1 if a required tool or a hard requirement is missing; missing
# optional tools and port/hosts problems are warnings only.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${DOMAIN:-agentflow.test}"
HOSTS_MARKER="# agentflow"
MIN_VM_GIB="${MIN_VM_GIB:-9}"

if [[ -t 1 ]]; then
  RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; DIM=$'\033[2m'; RST=$'\033[0m'
else
  RED=''; YEL=''; GRN=''; DIM=''; RST=''
fi

errors=0
warnings=0

fail() { printf '%sFAIL%s  %s\n' "$RED" "$RST" "$*"; errors=$((errors + 1)); }
warn() { printf '%sWARN%s  %s\n' "$YEL" "$RST" "$*"; warnings=$((warnings + 1)); }
ok()   { printf '%s  OK%s  %s\n' "$GRN" "$RST" "$*"; }

# Required tools: "<binary>|<brew formula>|<version command>"
REQUIRED=(
  "docker|--cask orbstack|docker --version"
  "kind|kind|kind version"
  "kubectl|kubernetes-cli|kubectl version --client=true"
  "helm|helm|helm version --short"
  "kustomize|kustomize|kustomize version"
  "istioctl|istioctl|istioctl version --remote=false"
  "terraform|hashicorp/tap/terraform|terraform version"
  "yq|yq|yq --version"
)

# Optional tools: nice to have, never block `make local-up`.
OPTIONAL=(
  "argocd|argocd|argocd version --client"
  "kubectl-argo-rollouts|argoproj/tap/kubectl-argo-rollouts|kubectl-argo-rollouts version"
  "kubeconform|kubeconform|kubeconform -v"
  "kyverno|kyverno|kyverno version"
  "promtool|prometheus|promtool --version"
  "cosign|cosign|cosign version 2>&1 | grep -i GitVersion"
  "trivy|trivy|trivy --version"
  "hey|hey|true"
  "k6|k6|k6 version"
  "k9s|k9s|k9s version --short"
  "stern|stern|stern --version"
  "jq|jq|jq --version"
  "shellcheck|shellcheck|shellcheck --version"
  "actionlint|actionlint|actionlint -version"
  "tflint|tflint|tflint --version"
)

first_line() { head -n 1 | tr -d '\r'; }

check_tool() {
  local spec="$1" required="$2"
  local bin formula versioncmd version
  bin="${spec%%|*}"
  formula="$(printf '%s' "$spec" | cut -d'|' -f2)"
  versioncmd="$(printf '%s' "$spec" | cut -d'|' -f3-)"

  if ! command -v "$bin" >/dev/null 2>&1; then
    if [[ "$required" == "yes" ]]; then
      fail "$(printf '%-24s missing        brew install %s' "$bin" "$formula")"
    else
      warn "$(printf '%-24s missing        brew install %s' "$bin" "$formula")"
    fi
    return
  fi

  version="$(eval "$versioncmd" 2>/dev/null | first_line || true)"
  [[ -n "$version" ]] || version="installed"
  printf '%s      %s%s %s%s\n' "$GRN" "$RST" "$(printf '%-24s' "$bin")" "$DIM" "${version}${RST}"
}

printf '\n%s== required tools ==%s\n' "$DIM" "$RST"
for spec in "${REQUIRED[@]}"; do check_tool "$spec" yes; done

printf '\n%s== optional tools ==%s\n' "$DIM" "$RST"
for spec in "${OPTIONAL[@]}"; do check_tool "$spec" no; done

printf '\n%s== container runtime ==%s\n' "$DIM" "$RST"
if ! command -v docker >/dev/null 2>&1; then
  fail "docker CLI missing, cannot inspect the VM"
elif ! docker info >/dev/null 2>&1; then
  fail "\`docker info\` failed. Open OrbStack (or start Colima) and retry."
else
  ok "docker daemon reachable"

  mem_bytes="$(docker info --format '{{.MemTotal}}' 2>/dev/null || echo 0)"
  if [[ "$mem_bytes" =~ ^[0-9]+$ ]] && [[ "$mem_bytes" -gt 0 ]]; then
    mem_gib=$((mem_bytes / 1024 / 1024 / 1024))
    if [[ "$mem_gib" -lt "$MIN_VM_GIB" ]]; then
      fail "VM memory ${mem_gib} GiB < ${MIN_VM_GIB} GiB. OrbStack > Settings > System: set 10 GiB / 6 CPU."
    else
      ok "VM memory ${mem_gib} GiB"
    fi
  else
    warn "could not read the VM memory size from \`docker info\`"
  fi

  cpus="$(docker info --format '{{.NCPU}}' 2>/dev/null || echo 0)"
  if [[ "$cpus" =~ ^[0-9]+$ ]] && [[ "$cpus" -lt 4 ]]; then
    warn "VM has ${cpus} CPUs; 6 is the comfortable minimum for the full profile"
  else
    ok "VM CPUs ${cpus}"
  fi
fi

printf '\n%s== host ports ==%s\n' "$DIM" "$RST"
for port in 80 443; do
  if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    holder="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -F c 2>/dev/null | sed -n 's/^c//p' | sort -u | tr '\n' ' ')"
    warn "port ${port} already bound by: ${holder:-unknown}. kind cannot map it; stop that process or set http_port/https_port to 8080/8443."
  else
    ok "port ${port} free"
  fi
done

printf '\n%s== /etc/hosts ==%s\n' "$DIM" "$RST"
if grep -q "$HOSTS_MARKER" /etc/hosts 2>/dev/null; then
  missing=()
  for svc in api studio dashboard grafana argocd kiali rollouts prometheus alertmanager; do
    grep -E "^127\.0\.0\.1[[:space:]].*[[:space:]]${svc}\.${DOMAIN}([[:space:]]|$)" /etc/hosts >/dev/null 2>&1 \
      || missing+=("${svc}.${DOMAIN}")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    warn "hosts entry incomplete, missing: ${missing[*]}. Run: ${REPO_ROOT}/scripts/hosts-setup.sh"
  else
    ok "all *.${DOMAIN} hosts resolve to 127.0.0.1"
  fi
else
  warn "no '${HOSTS_MARKER}' line in /etc/hosts. Run: ${REPO_ROOT}/scripts/hosts-setup.sh (asks for sudo once)"
fi

printf '\n'
if [[ "$errors" -gt 0 ]]; then
  printf '%s%d blocking problem(s), %d warning(s).%s\n' "$RED" "$errors" "$warnings" "$RST"
  exit 1
fi
printf '%sReady.%s %d warning(s).\n' "$GRN" "$RST" "$warnings"
