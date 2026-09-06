#!/usr/bin/env bash
#
# Destroys the ephemeral EKS demo environment, in the order that actually
# works.
#
#   make aws-down                     # asks once
#   make aws-down -y                  # no question (CI)
#   DRY_RUN=1 scripts/aws-down.sh -y  # print every command, touch nothing
#
# Why the order matters: `terraform destroy` on its own fails, because the
# cluster creates AWS objects Terraform never knew about. The Kubernetes
# Service of type LoadBalancer owns an NLB, every PVC owns an EBS volume,
# and the VPC cannot go while an ENI or a security group still points at
# it. So:
#
#   1. ArgoCD Applications  (stops anything from being recreated)
#   2. LoadBalancer Services and PVCs (releases NLB and EBS)
#   3. wait for AWS to catch up, then delete whatever is still there
#   4. terraform destroy, with two known recovery paths
#   5. scripts/aws-check-clean.sh - the receipt
#
# What is NOT destroyed: infra/bootstrap. The state bucket, the budget,
# the GitHub OIDC role and the secrets agentflow/demo/{app,ca} survive on
# purpose - the demo CA has to stay trusted between sessions.
#
set -euo pipefail

LOG_TAG="aws-down"
# shellcheck source=scripts/lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

SKIP_CLEAN_CHECK=0
KEEP_KUBECONFIG=0
WAIT_AWS="${WAIT_AWS:-300}"
CLUSTER_TAG="kubernetes.io/cluster/${CLUSTER_NAME}"

usage() {
  cat <<'EOF'
Usage: scripts/aws-down.sh [options]

  -y, --yes            do not ask for confirmation
      --skip-check     do not run scripts/aws-check-clean.sh afterwards
      --keep-context   leave the kubeconfig entry in place
      --dry-run        print the commands instead of running them
  -h, --help           this text

Environment: AWS_PROFILE, AWS_REGION (eu-west-1), DRY_RUN=1, WAIT_AWS
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1; shift ;;
    --skip-check) SKIP_CLEAN_CHECK=1; shift ;;
    --keep-context) KEEP_KUBECONFIG=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "unknown argument: $1"; usage >&2; exit 2 ;;
  esac
done

TF_ABS="${REPO_ROOT}/${TF_DIR}"
KCTX="$KUBE_CONTEXT_AWS"
kube() { kubectl --context "$KCTX" "$@"; }

need_cmd terraform kubectl aws jq
need_cmd_report || exit 1

########################################################################
# 0. Confirm
########################################################################
banner "destroy agentflow-demo"
if started="$(session_get started_at 2>/dev/null)"; then
  log "this session started at ${started}"
fi
confirm "Destroy the EKS cluster, the RDS instance and the VPC?" || die "aborted"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
if [[ -z "$ACCOUNT_ID" || "$ACCOUNT_ID" == "None" ]]; then
  if [[ "$DRY_RUN" == "1" ]]; then
    ACCOUNT_ID="000000000000"
    warn "no AWS credentials; dry run continues with a fake account id"
  else
    die "aws sts get-caller-identity failed; nothing was destroyed"
  fi
fi
STATE_BUCKET="agentflow-tfstate-${ACCOUNT_ID}"

########################################################################
# 1-2. Drain the cluster, if it still answers
########################################################################
api_reachable() {
  [[ "$DRY_RUN" == "1" ]] && return 0
  kube cluster-info >/dev/null 2>&1
}

if api_reachable; then
  phase "argocd applications"
  # Deleting the Applications first stops ArgoCD from recreating the very
  # Services and PVCs we are about to remove.
  if ! run kubectl --context "$KCTX" -n argocd delete applications.argoproj.io --all --timeout=10m; then
    warn "the delete timed out; ArgoCD's resources-finalizer is stuck on an unreachable resource"
    log "stripping finalizers and deleting again"
    if [[ "$DRY_RUN" == "1" ]]; then
      run kubectl --context "$KCTX" -n argocd patch applications.argoproj.io '<each>' \
        --type merge -p '{"metadata":{"finalizers":null}}'
    else
      while read -r app; do
        [[ -z "$app" ]] && continue
        kube -n argocd patch applications.argoproj.io "$app" \
          --type merge -p '{"metadata":{"finalizers":null}}' >/dev/null 2>&1 || true
      done < <(kube -n argocd get applications.argoproj.io -o name 2>/dev/null || true)
    fi
    run kubectl --context "$KCTX" -n argocd delete applications.argoproj.io --all \
      --wait=false --ignore-not-found || true
  fi
  phase_end

  phase "load balancer services and volumes"
  # Every Service of type LoadBalancer holds an NLB; every PVC holds an
  # EBS volume. Both are invisible to Terraform.
  if [[ "$DRY_RUN" == "1" ]]; then
    run kubectl --context "$KCTX" delete svc '<every type=LoadBalancer service>' -n '<ns>'
  else
    while read -r ns name; do
      [[ -z "$ns" ]] && continue
      log "deleting Service ${ns}/${name} (type LoadBalancer)"
      kube -n "$ns" delete svc "$name" --timeout=5m --ignore-not-found || true
    done < <(kube get svc -A \
      -o jsonpath='{range .items[?(@.spec.type=="LoadBalancer")]}{.metadata.namespace}{" "}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
  fi

  run kubectl --context "$KCTX" delete pvc --all --all-namespaces --timeout=5m || true
  phase_end
else
  warn "the cluster API does not answer; going straight to terraform destroy"
  warn "leftover NLBs and EBS volumes will be cleaned up by hand below"
fi

########################################################################
# 3. Wait for AWS, then remove the stragglers
########################################################################
phase "wait for AWS to release the load balancers and volumes"

# The ELBv2 API has no tag filter, so every load balancer is listed and
# then asked for its tags. A demo account has one or two of them.
cluster_lb_arns() {
  local arns arn
  local -a arn_list=()
  arns="$(aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn' --output text 2>/dev/null || true)"
  [[ -z "$arns" || "$arns" == "None" ]] && return 0
  read -ra arn_list <<< "$arns"
  for arn in "${arn_list[@]}"; do
    if aws elbv2 describe-tags --resource-arns "$arn" \
         --query "TagDescriptions[0].Tags[?Key=='${CLUSTER_TAG}'].Key" \
         --output text 2>/dev/null | grep -q .; then
      printf '%s\n' "$arn"
    fi
  done
}

cluster_volume_ids() {
  aws ec2 describe-volumes \
    --filters "Name=tag-key,Values=${CLUSTER_TAG}" \
    --query 'Volumes[].VolumeId' --output text 2>/dev/null | tr '\t' '\n' | grep -v '^$' || true
}

aws_drained() {
  local lbs vols
  lbs="$(cluster_lb_arns)"
  vols="$(cluster_volume_ids)"
  [[ -z "$lbs" && -z "$vols" ]]
}

if [[ "$DRY_RUN" == "1" ]]; then
  run aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn'
  run aws ec2 describe-volumes --filters "Name=tag-key,Values=${CLUSTER_TAG}"
  log "would wait up to ${WAIT_AWS}s for both to be empty, then delete the stragglers"
else
  if ! wait_for "$WAIT_AWS" 15 "AWS to release the cluster's NLBs and EBS volumes" aws_drained; then
    warn "still not empty after $(fmt_duration "$WAIT_AWS"); deleting what is left directly"
    while read -r arn; do
      [[ -z "$arn" ]] && continue
      log "deleting load balancer ${arn##*/}"
      aws elbv2 delete-load-balancer --load-balancer-arn "$arn" || true
    done < <(cluster_lb_arns)
    while read -r vol; do
      [[ -z "$vol" ]] && continue
      log "deleting volume ${vol}"
      aws ec2 delete-volume --volume-id "$vol" || true
    done < <(cluster_volume_ids)
  fi
fi
phase_end

########################################################################
# 4. Terraform destroy, with the two failures we know about
########################################################################
phase "terraform destroy"

run terraform -chdir="$TF_ABS" init -reconfigure -input=false \
  -backend-config="bucket=${STATE_BUCKET}" \
  -backend-config="key=aws-demo/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="encrypt=true" \
  -backend-config="use_lockfile=true"

DESTROY_LOG="$(mktemp -t agentflow-destroy)"

destroy() {
  if [[ "$DRY_RUN" == "1" ]]; then
    run terraform -chdir="$TF_ABS" destroy -auto-approve -input=false
    return 0
  fi
  # tee so the operator watches it live and the script can grep it after.
  terraform -chdir="$TF_ABS" destroy -auto-approve -input=false 2>&1 | tee "$DESTROY_LOG"
  return "${PIPESTATUS[0]}"
}

# Recovery 1: the helm provider needs a live API server to delete a
# release. Once the cluster is gone (or unreachable) those two resources
# can never be destroyed, only forgotten.
recover_helm() {
  grep -qiE 'kubernetes cluster unreachable|could not get apiVersions|connection refused|dial tcp.*:443|no such host' "$DESTROY_LOG"
}

# Recovery 2: the VPC refuses to go while an ENI or a security group made
# by the cloud controller still lives in it.
recover_vpc() {
  grep -qi 'DependencyViolation' "$DESTROY_LOG"
}

delete_cluster_enis_and_sgs() {
  local vpc_id
  vpc_id="$(aws ec2 describe-vpcs \
    --filters "Name=tag:Name,Values=${CLUSTER_NAME}*" \
    --query 'Vpcs[0].VpcId' --output text 2>/dev/null || true)"
  [[ -z "$vpc_id" || "$vpc_id" == "None" ]] && { warn "no VPC found to clean up"; return 0; }
  log "cleaning leftovers in ${vpc_id}"

  while read -r eni; do
    [[ -z "$eni" ]] && continue
    log "detaching and deleting ENI ${eni}"
    att="$(aws ec2 describe-network-interfaces --network-interface-ids "$eni" \
      --query 'NetworkInterfaces[0].Attachment.AttachmentId' --output text 2>/dev/null || true)"
    if [[ -n "$att" && "$att" != "None" ]]; then
      aws ec2 detach-network-interface --attachment-id "$att" --force || true
    fi
    aws ec2 delete-network-interface --network-interface-id "$eni" || true
  done < <(aws ec2 describe-network-interfaces \
    --filters "Name=vpc-id,Values=${vpc_id}" "Name=status,Values=available,in-use" \
    --query 'NetworkInterfaces[].NetworkInterfaceId' --output text 2>/dev/null | tr '\t' '\n' | grep -v '^$' || true)

  while read -r sg; do
    [[ -z "$sg" ]] && continue
    log "deleting security group ${sg}"
    aws ec2 delete-security-group --group-id "$sg" || true
  done < <(aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=${vpc_id}" \
    --query "SecurityGroups[?GroupName!='default'].GroupId" --output text 2>/dev/null | tr '\t' '\n' | grep -v '^$' || true)
}

if ! destroy; then
  warn "terraform destroy failed; looking at why"

  if [[ "$DRY_RUN" != "1" ]] && recover_helm; then
    warn "the helm provider cannot reach the cluster: forgetting the two releases"
    log "they live inside the cluster, so destroying the cluster destroys them"
    run terraform -chdir="$TF_ABS" state rm helm_release.platform_root || true
    run terraform -chdir="$TF_ABS" state rm helm_release.argocd || true
    destroy || die "destroy still failing after dropping the helm releases; run \`make aws-check-clean\` and look at ${DESTROY_LOG}"
  elif [[ "$DRY_RUN" != "1" ]] && recover_vpc; then
    warn "DependencyViolation: something the cloud controller made is still in the VPC"
    delete_cluster_enis_and_sgs
    destroy || die "destroy still failing after the ENI/SG sweep; run \`make aws-check-clean\` and look at ${DESTROY_LOG}"
  else
    die "unhandled destroy failure; the log is at ${DESTROY_LOG}"
  fi
fi
phase_end

########################################################################
# 5. Receipt
########################################################################
if [[ "$KEEP_KUBECONFIG" == "0" ]]; then
  run kubectl config delete-context "$KCTX" || true
  run kubectl config delete-cluster "arn:aws:eks:${AWS_REGION}:${ACCOUNT_ID}:cluster/${CLUSTER_NAME}" || true
fi

if [[ "$DRY_RUN" != "1" ]]; then
  session_clear
fi

if [[ "$SKIP_CLEAN_CHECK" == "1" ]]; then
  warn "--skip-check: nothing has been verified. Run \`make aws-check-clean\` yourself."
else
  phase "check that nothing is left"
  if ! run "${REPO_ROOT}/scripts/aws-check-clean.sh"; then
    err "leftovers found. They cost money: read the table above and delete them."
    exit 1
  fi
  phase_end
fi

banner "agentflow-demo destroyed in $(elapsed)"
log "infra/bootstrap is untouched: state bucket, budget, OIDC role, agentflow/demo/{app,ca}"
