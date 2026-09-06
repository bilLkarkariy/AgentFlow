#!/usr/bin/env bash
#
# Creates the ephemeral EKS demo environment, end to end.
#
#   make aws-up                       # SPOT capacity, revision main
#   make aws-up CAPACITY_TYPE=ON_DEMAND
#   DRY_RUN=1 scripts/aws-up.sh       # print every command, touch nothing
#
# Sequence:
#   1. preflight        tools, identity, state bucket, bootstrap secrets
#   2. terraform        init with the S3 backend, apply
#   3. kubeconfig       context `agentflow-aws`, gp2 loses the default flag
#   4. render + commit  environment facts into deploy/, pushed to the branch
#   5. wait             nodes, ArgoCD Applications, the NLB, then /health
#   6. report           URLs, `make aws-ui`, and a reminder to tear it down
#
# Step 4 is the deliberate part of the design: ArgoCD only reads Git, and
# the EIP / subnet / role ids only exist after step 2. See the header of
# scripts/aws-render-env.sh.
#
# THIS SCRIPT COSTS MONEY (~0.24 USD/h). It writes ~/.agentflow/session so
# `make aws-cost` can tell you how much, and it ends with a reminder.
#
set -euo pipefail

LOG_TAG="aws-up"
# shellcheck source=scripts/lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

CAPACITY_TYPE="${CAPACITY_TYPE:-SPOT}"
GITOPS_REV="${GITOPS_REV:-main}"
SKIP_RENDER=0
NO_PUSH="${NO_PUSH:-0}"
SKIP_WAIT=0

# Timeouts, in seconds.
WAIT_NODES="${WAIT_NODES:-600}"
WAIT_APPS="${WAIT_APPS:-1200}"
WAIT_LB="${WAIT_LB:-300}"
WAIT_HEALTH="${WAIT_HEALTH:-300}"

COMMIT_MSG='chore(gitops): render aws environment [skip ci]'

usage() {
  cat <<'EOF'
Usage: scripts/aws-up.sh [options]

  -y, --yes                 do not ask anything
      --capacity-type T     SPOT (default) or ON_DEMAND
      --gitops-revision R   branch ArgoCD follows (default: main)
      --skip-render         do not touch or commit deploy/ (expert use)
      --no-push             render and commit, but do not push
      --skip-wait           return as soon as terraform is done
      --dry-run             print the commands instead of running them
  -h, --help                this text

Environment: CAPACITY_TYPE, GITOPS_REV, AWS_PROFILE, AWS_REGION (eu-west-1),
             DRY_RUN=1, WAIT_APPS (seconds)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1; shift ;;
    --capacity-type) CAPACITY_TYPE="${2:-}"; shift 2 ;;
    --capacity-type=*) CAPACITY_TYPE="${1#*=}"; shift ;;
    --gitops-revision) GITOPS_REV="${2:-}"; shift 2 ;;
    --gitops-revision=*) GITOPS_REV="${1#*=}"; shift ;;
    --skip-render) SKIP_RENDER=1; shift ;;
    --no-push) NO_PUSH=1; shift ;;
    --skip-wait) SKIP_WAIT=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "unknown argument: $1"; usage >&2; exit 2 ;;
  esac
done

case "$CAPACITY_TYPE" in
  SPOT|ON_DEMAND) ;;
  *) die "capacity type must be SPOT or ON_DEMAND, got '${CAPACITY_TYPE}'" ;;
esac

TF_ABS="${REPO_ROOT}/${TF_DIR}"
KCTX="$KUBE_CONTEXT_AWS"
kube() { kubectl --context "$KCTX" "$@"; }

########################################################################
# 1. Preflight
########################################################################
phase "preflight"

need_cmd terraform kubectl helm aws jq yq git curl
need_cmd_report || exit 1
ok "tools present"

[[ -d "$TF_ABS" ]] || die "no Terraform stack at ${TF_DIR}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
if [[ -n "$ACCOUNT_ID" && "$ACCOUNT_ID" != "None" ]]; then
  ok "aws identity, account ${ACCOUNT_ID}, region ${AWS_REGION}"
else
  if [[ "$DRY_RUN" == "1" ]]; then
    ACCOUNT_ID="000000000000"
    warn "no AWS credentials; dry run continues with a fake account id"
  else
    die "aws sts get-caller-identity failed. Run \`aws configure\` (or \`aws sso login\`) first."
  fi
fi

STATE_BUCKET="agentflow-tfstate-${ACCOUNT_ID}"

if [[ "$DRY_RUN" == "1" ]]; then
  log "would check that s3://${STATE_BUCKET} exists"
elif aws s3api head-bucket --bucket "$STATE_BUCKET" >/dev/null 2>&1; then
  ok "state bucket s3://${STATE_BUCKET}"
else
  err "state bucket s3://${STATE_BUCKET} does not exist or is not readable"
  die "run \`make aws-bootstrap\` once per account first"
fi

# Only the length of the secret is ever read, so a value cannot leak into
# a terminal, a CI log or a scrollback buffer.
if [[ "$DRY_RUN" == "1" ]]; then
  log "would check that the secret agentflow/demo/app holds a value"
else
  app_len="$(aws secretsmanager get-secret-value \
    --secret-id agentflow/demo/app \
    --query 'length(SecretString)' --output text 2>/dev/null || echo "")"
  if [[ -z "$app_len" || "$app_len" == "None" || "$app_len" -lt 2 ]]; then
    err "the Secrets Manager entry agentflow/demo/app is empty"
    die "run \`make aws-bootstrap\` (it pushes the values from your .env)"
  fi
  ok "agentflow/demo/app holds a value (${app_len} bytes)"
fi

# EKS standard support: a version in extended support costs six times the
# control plane price. Worth one API call before spending 25 minutes.
EKS_VERSION="$(yq -r '.kubernetes.eks_version // ""' "${REPO_ROOT}/deploy/versions.yaml" 2>/dev/null || true)"
if [[ -n "$EKS_VERSION" && "$DRY_RUN" != "1" ]]; then
  status="$(aws eks describe-cluster-versions \
    --query "clusterVersions[?clusterVersion=='${EKS_VERSION}'].versionStatus | [0]" \
    --output text 2>/dev/null || true)"
  case "$status" in
    STANDARD_SUPPORT) ok "EKS ${EKS_VERSION} is in standard support" ;;
    "" | None) log "could not check the support status of EKS ${EKS_VERSION} (old aws CLI?)" ;;
    *) warn "EKS ${EKS_VERSION} is ${status}: extended support costs ~6x the control plane. Bump deploy/versions.yaml." ;;
  esac
fi

log "capacity ${CAPACITY_TYPE}, gitops revision ${GITOPS_REV}"
confirm "Create the EKS demo environment (about 25 min, ~0.24 USD/h)?" \
  || die "aborted"
phase_end

########################################################################
# 2. Terraform
########################################################################
phase "terraform init"
run terraform -chdir="$TF_ABS" init -reconfigure -input=false \
  -backend-config="bucket=${STATE_BUCKET}" \
  -backend-config="key=aws-demo/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="encrypt=true" \
  -backend-config="use_lockfile=true"
phase_end

phase "terraform apply"
log "EKS control plane alone takes about 9 minutes"
run terraform -chdir="$TF_ABS" apply -auto-approve -input=false \
  -var "capacity_type=${CAPACITY_TYPE}" \
  -var "gitops_revision=${GITOPS_REV}"
phase_end

########################################################################
# 3. Kubeconfig
########################################################################
phase "kubeconfig"
run aws eks update-kubeconfig \
  --region "$AWS_REGION" \
  --name "$CLUSTER_NAME" \
  --alias "$KCTX"

# The EBS CSI driver ships gp2 as the default StorageClass; every PVC in
# this repo asks for gp3 explicitly, and leaving two defaults around is a
# scheduling trap. Failure is fine: a newer add-on may not create gp2.
log "removing the default-class flag from the gp2 StorageClass"
run kubectl --context "$KCTX" annotate storageclass gp2 \
  storageclass.kubernetes.io/is-default-class- --overwrite || true
phase_end

########################################################################
# 4. Render the environment into Git
########################################################################
DOMAIN_AWS=""
if [[ "$DRY_RUN" == "1" ]]; then
  DOMAIN_AWS="<ingress_domain>"
else
  DOMAIN_AWS="$(tf_out ingress_domain "$TF_ABS")" || die "cannot read the terraform outputs"
  [[ -n "$DOMAIN_AWS" ]] || die "the terraform output ingress_domain is empty"
fi

if [[ "$SKIP_RENDER" == "1" ]]; then
  warn "--skip-render: deploy/ keeps whatever is committed today"
else
  phase "render the environment into git"

  # A plain read loop rather than `mapfile`: macOS still ships bash 3.2 as
  # /bin/bash, and `env bash` finds it first on a machine without Homebrew
  # bash.
  rendered=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && rendered+=("$line")
  done < <("${REPO_ROOT}/scripts/aws-render-env.sh" --print-files)
  [[ ${#rendered[@]} -gt 0 ]] || die "aws-render-env.sh --print-files returned nothing"

  # Refuse to sweep somebody else's work into a GitOps commit.
  if [[ "$DRY_RUN" != "1" ]]; then
    staged="$(git -C "$REPO_ROOT" diff --cached --name-only)"
    if [[ -n "$staged" ]]; then
      unrelated=""
      while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        keep=0
        for r in "${rendered[@]}"; do [[ "$f" == "$r" ]] && keep=1; done
        [[ "$keep" == "0" ]] && unrelated+="  ${f}"$'\n'
      done <<< "$staged"
      if [[ -n "$unrelated" ]]; then
        err "the index already holds changes this script must not commit:"
        printf '%s' "$unrelated" >&2
        die "commit or reset them, then run \`make aws-up\` again"
      fi
    fi
  fi

  run "${REPO_ROOT}/scripts/aws-render-env.sh" --tf-dir "$TF_ABS"

  BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)"
  [[ "$BRANCH" != "HEAD" ]] || die "detached HEAD: check out the branch ArgoCD follows first"

  run git -C "$REPO_ROOT" add -- "${rendered[@]}"

  if [[ "$DRY_RUN" == "1" ]] || ! git -C "$REPO_ROOT" diff --cached --quiet -- "${rendered[@]}"; then
    run git -C "$REPO_ROOT" commit -m "$COMMIT_MSG"
    if [[ "$NO_PUSH" == "1" ]]; then
      warn "--no-push: ArgoCD will not see the render until you push ${BRANCH}"
    else
      # `git push` is retried: a parallel promotion commit is the normal
      # reason it bounces, and a rebase fixes it.
      if ! run git -C "$REPO_ROOT" push origin "HEAD:${BRANCH}"; then
        warn "push rejected, rebasing on origin/${BRANCH} and retrying"
        run git -C "$REPO_ROOT" pull --rebase origin "$BRANCH"
        run git -C "$REPO_ROOT" push origin "HEAD:${BRANCH}"
      fi
    fi
  else
    ok "deploy/ already matches this environment, nothing to commit"
  fi
  phase_end
fi

########################################################################
# 5. Wait for the platform
########################################################################
if [[ "$SKIP_WAIT" == "1" ]]; then
  warn "--skip-wait: the cluster is up but nothing has been verified"
else
  phase "nodes"
  nodes_ready() {
    local out
    out="$(kube get nodes \
      -o jsonpath='{range .items[*]}{.status.conditions[?(@.type=="Ready")].status}{"\n"}{end}' 2>/dev/null)" || return 1
    [[ -n "$out" ]] || return 1
    ! grep -qv '^True$' <<< "$out"
  }
  wait_for "$WAIT_NODES" 10 "every node Ready" nodes_ready \
    || die "nodes never became Ready. Spot capacity is the usual cause: retry with CAPACITY_TYPE=ON_DEMAND."
  phase_end

  phase "argocd applications"
  log "platform-root renders the catalogue, then each wave syncs"
  if [[ "$DRY_RUN" == "1" ]]; then
    run env "KUBE_CONTEXT=${KCTX}" "WAIT_TIMEOUT=${WAIT_APPS}" "${REPO_ROOT}/scripts/wait-apps.sh"
  else
    KUBE_CONTEXT="$KCTX" WAIT_TIMEOUT="$WAIT_APPS" MIN_APPS="${MIN_APPS:-5}" \
      "${REPO_ROOT}/scripts/wait-apps.sh" \
      || die "some Applications never went Synced+Healthy. \`make aws-status\` shows which."
  fi
  phase_end

  phase "network load balancer"
  lb_ready() {
    local host
    host="$(kube -n istio-ingress get svc istio-ingressgateway \
      -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)" || return 1
    [[ -n "$host" ]]
  }
  wait_for "$WAIT_LB" 10 "istio-ingressgateway to get an address" lb_ready \
    || die "the NLB stayed <pending>: check that the EIP count matches the tagged subnet count (see aws-render-env.sh)"
  phase_end

  phase "api health"
  api_healthy() {
    local code
    code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 \
      "https://api.${DOMAIN_AWS}/health" 2>/dev/null || echo 000)"
    [[ "$code" == "200" ]]
  }
  if [[ "$DRY_RUN" == "1" ]]; then
    wait_for "$WAIT_HEALTH" 10 "https://api.${DOMAIN_AWS}/health to answer 200" \
      curl -sk "https://api.${DOMAIN_AWS}/health"
  else
    wait_for "$WAIT_HEALTH" 10 "https://api.${DOMAIN_AWS}/health to answer 200" api_healthy \
      || die "the API never answered. \`make aws-status\`, then \`kubectl --context ${KCTX} -n agentflow get pods\`."
  fi
  phase_end
fi

########################################################################
# 6. Report
########################################################################
if [[ "$DRY_RUN" != "1" ]]; then
  session_write "$DOMAIN_AWS"
fi

printf '\n'
banner "agentflow-demo is up (${DOMAIN_AWS}) in $(elapsed)"
cat <<EOF

  API         https://api.${DOMAIN_AWS}/health
  Studio      https://studio.${DOMAIN_AWS}
  Dashboard   https://dashboard.${DOMAIN_AWS}

  kubectl context   ${KCTX}
  admin UIs         make aws-ui          (ArgoCD, Grafana, Kiali, Rollouts)
  browser warning   make aws-trust-ca    (trusts the demo CA once)
  what is running   make aws-status
  what it costs     make aws-cost

EOF
printf '%s%s\n' "$C_RED$C_BLD" "  ############################################################"
printf '%s\n'   "  #  This environment bills about 0.24 USD per hour.         #"
printf '%s\n'   "  #  RUN  make aws-down  WHEN YOU ARE DONE.                  #"
printf '%s\n'   "  #  Then  make aws-check-clean  to prove nothing is left.   #"
printf '%s%s\n\n' "  ############################################################" "$C_RST"
