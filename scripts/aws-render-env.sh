#!/usr/bin/env bash
#
# Writes the facts that only exist after `terraform apply` into the files
# ArgoCD reads.
#
# Why this exists
# ---------------
# ArgoCD only ever reads Git. But the EIP allocation ids, the subnet ids,
# the sslip.io domain, the IRSA role ARNs and the Loki bucket name are not
# knowable until the VPC exists. Something has to bridge that gap, and the
# honest options are: a values file rendered by a script and committed, or
# a second templating layer (an ApplicationSet plugin, a Config Management
# Plugin, an Argo CD parameter override written by the CLI). This repo
# takes the first one: `make aws-up` renders these files, commits them
# with `chore(gitops): render aws environment [skip ci]`, pushes, and only
# then waits for ArgoCD. The environment is therefore reproducible from
# the repository alone, and `git log` shows exactly which infrastructure
# each sync belonged to.
#
# The rules that make it safe
# ---------------------------
# * KEY BASED, NEVER PLACEHOLDER BASED. Every write is a yq path
#   assignment (or a kustomize patch file whose path is addressed by yq).
#   The second `make aws-up` therefore overwrites yesterday's account id
#   just as happily as it overwrote the placeholder on day one.
# * IDEMPOTENT. Running it twice with the same inputs changes nothing;
#   `--check` exits 1 when a file would change (`make aws-render-check`),
#   handy before committing after an `aws-up`.
# * NO SECRETS. Bucket names, subnet ids and role ARNs are identifiers,
#   not credentials. Passwords live in Secrets Manager and reach the
#   cluster through External Secrets, never through this script.
#
# Usage
#   scripts/aws-render-env.sh                     # read terraform outputs
#   scripts/aws-render-env.sh --from-json out.json  # read a fixture
#   scripts/aws-render-env.sh --check             # exit 1 if it would change
#   scripts/aws-render-env.sh --print-files       # list the managed files
#
set -euo pipefail

LOG_TAG="render-env"
# shellcheck source=scripts/lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

# --------------------------------------------------------------------
# The complete list of files this script owns. `make aws-up` stages
# exactly these, so a stray edit elsewhere in the tree is never swept
# into the GitOps commit.
# --------------------------------------------------------------------
RENDERED_FILES=(
  "deploy/platform/istio/gateway/values-aws.yaml"
  "deploy/platform/external-secrets/values-aws.yaml"
  "deploy/platform/loki/values-aws.yaml"
  "deploy/platform/cert-manager/manifests/overlays/aws/wildcard-domain.yaml"
  "deploy/envs/aws/api.yaml"
  "deploy/envs/aws/studio.yaml"
  "deploy/envs/aws/dashboard.yaml"
)

# Kiali (external_services.grafana.external_url) and Grafana
# (grafana.ini.server.root_url) are deliberately NOT in that list: on AWS
# the admin UIs are never published, they are port-forwarded by
# `make aws-ui`, so their URLs are localhost and carry no environment
# fact. scripts/aws-ui.sh is the single definition of those ports.

FROM_JSON=""
CHECK=0
PRINT_FILES=0

usage() {
  sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//; $d'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-json) FROM_JSON="${2:-}"; shift 2 ;;
    --from-json=*) FROM_JSON="${1#*=}"; shift ;;
    --tf-dir) TF_DIR="${2:-}"; shift 2 ;;
    --tf-dir=*) TF_DIR="${1#*=}"; shift ;;
    --check) CHECK=1; shift ;;
    --print-files) PRINT_FILES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "unknown argument: $1"; usage >&2; exit 2 ;;
  esac
done

if [[ "$PRINT_FILES" == "1" ]]; then
  printf '%s\n' "${RENDERED_FILES[@]}"
  exit 0
fi

need_cmd yq jq
[[ -n "$FROM_JSON" ]] || need_cmd terraform
need_cmd_report || exit 1

# --------------------------------------------------------------------
# Inputs
# --------------------------------------------------------------------
OUTPUT_JSON=""

load_outputs() {
  if [[ -n "$FROM_JSON" ]]; then
    [[ -f "$FROM_JSON" ]] || die "no such file: ${FROM_JSON}"
    jq -e . "$FROM_JSON" >/dev/null 2>&1 || die "${FROM_JSON} is not valid JSON"
    OUTPUT_JSON="$FROM_JSON"
    log "reading ${FROM_JSON}"
    return 0
  fi

  # --tf-dir accepts both a repo-relative path (the default) and an
  # absolute one (aws-up.sh passes the absolute path it already resolved).
  local dir="$TF_DIR"
  [[ "$dir" == /* ]] || dir="${REPO_ROOT}/${TF_DIR}"
  [[ -d "$dir" ]] || die "no Terraform directory at ${TF_DIR} (is infra/envs/aws-demo checked out?)"
  OUTPUT_JSON="$(mktemp -t agentflow-render)"
  log "reading terraform -chdir=${TF_DIR} output -json"
  terraform -chdir="$dir" output -json > "$OUTPUT_JSON" \
    || die "terraform output failed; run \`make aws-up\` first"
}

# out <name> [required]
#   Accepts both shapes: the real `terraform output -json`
#   ({"name":{"value":X}}) and a flat fixture ({"name":X}). Lists come
#   back as a comma separated line, which is what every AWS annotation
#   wants anyway.
out() {
  local name="$1" required="${2:-yes}" value
  value="$(jq -r --arg n "$name" '
    (.[$n] // empty)
    | (if (type == "object" and has("value")) then .value else . end)
    | if type == "array" then join(",")
      elif type == "object" then tojson
      elif . == null then ""
      else tostring end
  ' "$OUTPUT_JSON")"
  if [[ -z "$value" && "$required" == "yes" ]]; then
    die "terraform output '${name}' is missing or empty"
  fi
  printf '%s' "$value"
}

load_outputs

DOMAIN_OUT="$(out ingress_domain)"
EIP_ALLOCATIONS="$(out ingress_eip_allocation_ids)"
PUBLIC_SUBNETS="$(out public_subnet_ids)"
ESO_ROLE_ARN="$(out eso_role_arn)"
LOKI_ROLE_ARN="$(out loki_role_arn)"
LOKI_BUCKET="$(out loki_bucket)"
REGION_OUT="$(out region no)"
[[ -n "$REGION_OUT" ]] || REGION_OUT="$AWS_REGION"

# --------------------------------------------------------------------
# Sanity checks. A wrong value here is a 20 minute debugging session with
# an NLB stuck in <pending>, so the cheap assertions are worth it.
# --------------------------------------------------------------------
[[ "$DOMAIN_OUT" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] \
  || die "ingress_domain '${DOMAIN_OUT}' does not look like a hostname"

count_csv() { [[ -z "$1" ]] && { printf '0'; return; }; awk -F',' '{print NF}' <<< "$1"; }

n_eips="$(count_csv "$EIP_ALLOCATIONS")"
n_subnets="$(count_csv "$PUBLIC_SUBNETS")"
if [[ "$n_eips" != "$n_subnets" ]]; then
  die "one EIP per subnet is required: ${n_eips} allocation(s) for ${n_subnets} subnet(s); the NLB would stay <pending>"
fi
[[ "$EIP_ALLOCATIONS" =~ ^eipalloc- ]] || die "ingress_eip_allocation_ids does not start with eipalloc-: '${EIP_ALLOCATIONS}'"
[[ "$PUBLIC_SUBNETS" =~ ^subnet- ]]    || warn "public_subnet_ids does not start with subnet-: '${PUBLIC_SUBNETS}'"
[[ "$ESO_ROLE_ARN" =~ ^arn:aws[a-z-]*:iam:: ]]  || die "eso_role_arn is not an IAM role ARN: '${ESO_ROLE_ARN}'"
[[ "$LOKI_ROLE_ARN" =~ ^arn:aws[a-z-]*:iam:: ]] || die "loki_role_arn is not an IAM role ARN: '${LOKI_ROLE_ARN}'"

# Derived values, exported so yq can read them with strenv() and never
# have to be spliced into the expression string.
export EIP_ALLOCATIONS PUBLIC_SUBNETS ESO_ROLE_ARN LOKI_ROLE_ARN LOKI_BUCKET
export RENDER_REGION="$REGION_OUT"
export RENDER_DOMAIN="$DOMAIN_OUT"
export RENDER_WILDCARD="*.${DOMAIN_OUT}"
export RENDER_API_HOST="api.${DOMAIN_OUT}"
export RENDER_STUDIO_HOST="studio.${DOMAIN_OUT}"
export RENDER_DASHBOARD_HOST="dashboard.${DOMAIN_OUT}"
export RENDER_API_BASE_URL="https://api.${DOMAIN_OUT}"

# --------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------
# yq v4 drops blank lines between nodes, which would turn a one-line
# change into a 40 line diff. Blank lines are parked as a marker comment
# for the duration of the edit and restored afterwards, so the diff shows
# exactly the values that moved.
BLANK_MARKER="#__AGENTFLOW_BLANK__"

changed_files=()
unchanged_files=()

render_file() {
  local rel="$1" expr="$2"
  local file="${REPO_ROOT}/${rel}"
  [[ -f "$file" ]] || die "expected file is missing: ${rel}"

  local marked edited result
  marked="$(mktemp -t agentflow-render)"
  edited="$(mktemp -t agentflow-render)"
  result="$(mktemp -t agentflow-render)"
  # shellcheck disable=SC2064  # expand the paths now, not at trap time
  trap "rm -f '$marked' '$edited' '$result'" RETURN

  sed "s|^\$|${BLANK_MARKER}|" "$file" > "$marked"
  yq "$expr" "$marked" > "$edited" || die "yq failed on ${rel}"
  # yq re-indents a marker that sat inside a nested mapping, so the
  # restore has to tolerate leading whitespace.
  sed -E "s|^[[:space:]]*${BLANK_MARKER}[[:space:]]*\$||" "$edited" > "$result"

  if cmp -s "$file" "$result"; then
    unchanged_files+=("$rel")
    printf '  %s%-62s%s %sunchanged%s\n' "$C_DIM" "$rel" "$C_RST" "$C_DIM" "$C_RST"
    return 0
  fi

  changed_files+=("$rel")
  if [[ "$CHECK" == "1" ]]; then
    printf '  %-62s %swould change%s\n' "$rel" "$C_YEL" "$C_RST"
    diff -u "$file" "$result" | sed 's/^/    /' || true
    return 0
  fi

  # Write through, so file mode and any hard link survive.
  cat "$result" > "$file"
  printf '  %-62s %srendered%s\n' "$rel" "$C_GRN" "$C_RST"
}

banner "render aws environment"
log "domain    ${RENDER_DOMAIN}"
log "eips      ${EIP_ALLOCATIONS}"
log "subnets   ${PUBLIC_SUBNETS}"
log "region    ${RENDER_REGION}"
log "loki      ${LOKI_BUCKET}"
printf '\n'

# 1. Ingress: the NLB keeps the two Elastic IPs the domain is built from.
render_file "deploy/platform/istio/gateway/values-aws.yaml" '
  .service.annotations."service.beta.kubernetes.io/aws-load-balancer-type" = "nlb" |
  .service.annotations."service.beta.kubernetes.io/aws-load-balancer-scheme" = "internet-facing" |
  .service.annotations."service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled" = "true" |
  .service.annotations."service.beta.kubernetes.io/aws-load-balancer-eip-allocations" = strenv(EIP_ALLOCATIONS) |
  .service.annotations."service.beta.kubernetes.io/aws-load-balancer-subnets" = strenv(PUBLIC_SUBNETS)
'

# 2. External Secrets reads Secrets Manager through this IRSA role.
render_file "deploy/platform/external-secrets/values-aws.yaml" '
  .serviceAccount.annotations."eks.amazonaws.com/role-arn" = strenv(ESO_ROLE_ARN)
'

# 3. Loki chunks land in an account-scoped S3 bucket, also through IRSA.
render_file "deploy/platform/loki/values-aws.yaml" '
  .loki.storage.bucketNames.chunks = strenv(LOKI_BUCKET) |
  .loki.storage.bucketNames.ruler = strenv(LOKI_BUCKET) |
  .loki.storage.s3.region = strenv(RENDER_REGION) |
  .serviceAccount.annotations."eks.amazonaws.com/role-arn" = strenv(LOKI_ROLE_ARN)
'

# 4. The wildcard certificate has to cover the domain the browser asks for.
render_file "deploy/platform/cert-manager/manifests/overlays/aws/wildcard-domain.yaml" '
  .spec.dnsNames = [strenv(RENDER_WILDCARD), strenv(RENDER_DOMAIN)]
'

# 5. The three published services. DEPLOY_ENV and image.tag are untouched:
#    promotion is a pull request (promote-aws.yml), not a side effect of
#    provisioning.
render_file "deploy/envs/aws/api.yaml" '
  .istio.virtualService.hosts[0] = strenv(RENDER_API_HOST)
'

render_file "deploy/envs/aws/studio.yaml" '
  .istio.virtualService.hosts[0] = strenv(RENDER_STUDIO_HOST) |
  .runtimeConfig.values.API_BASE_URL = strenv(RENDER_API_BASE_URL)
'

render_file "deploy/envs/aws/dashboard.yaml" '
  .istio.virtualService.hosts[0] = strenv(RENDER_DASHBOARD_HOST) |
  .runtimeConfig.values.API_BASE_URL = strenv(RENDER_API_BASE_URL)
'

printf '\n'
if [[ "$CHECK" == "1" ]]; then
  if [[ ${#changed_files[@]} -gt 0 ]]; then
    err "${#changed_files[@]} file(s) are out of date with the live environment:"
    printf '  %s\n' "${changed_files[@]}" >&2
    err "run \`make aws-render-env\` and commit the result"
    exit 1
  fi
  ok "every rendered file matches the live environment"
  exit 0
fi

if [[ ${#changed_files[@]} -eq 0 ]]; then
  ok "nothing to render, ${#unchanged_files[@]} file(s) already current"
else
  ok "rendered ${#changed_files[@]} file(s) for ${RENDER_DOMAIN}"
fi
