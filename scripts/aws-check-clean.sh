#!/usr/bin/env bash
#
# Proves that `make aws-down` really removed everything, or names what it
# missed.
#
#   make aws-check-clean          # full audit, exit 1 on any leftover
#   scripts/aws-check-clean.sh --guard
#                                 # cheap check used by aws-guard.yml:
#                                 # exit 1 only if a cluster, load
#                                 # balancer, RDS instance or EC2 instance
#                                 # is still running
#   DRY_RUN=1 scripts/aws-check-clean.sh
#
# The expensive mistakes this catches, in order of how often they happen:
#   * an unassociated Elastic IP        0.005 USD/h, forever, invisible
#   * an EBS volume with no instance    a Kubernetes PVC nobody deleted
#   * an NLB the cloud controller made  Terraform never knew about it
#   * a manual RDS snapshot             storage billed after the instance
#
# Two things are expected to survive and never count as leftovers: the
# Terraform state bucket and the bootstrap secrets agentflow/demo/{app,ca}
# (infra/bootstrap owns them, and the demo CA must stay stable).
#
set -euo pipefail

LOG_TAG="check-clean"
# shellcheck source=scripts/lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

GUARD=0
CLUSTER_TAG="kubernetes.io/cluster/${CLUSTER_NAME}"
PROJECT_TAG_KEY="${PROJECT_TAG_KEY:-Project}"
PROJECT_TAG_VALUE="${PROJECT_TAG_VALUE:-agentflow}"
KEEP_SECRETS=("agentflow/demo/app" "agentflow/demo/ca")

usage() {
  cat <<'EOF'
Usage: scripts/aws-check-clean.sh [--guard] [--dry-run]

  --guard     only fail when something expensive is still RUNNING
              (EKS cluster, load balancer, RDS instance, EC2 instance);
              used by the 6-hourly aws-guard workflow
  --dry-run   print the queries instead of running them
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --guard) GUARD=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "unknown argument: $1"; usage >&2; exit 2 ;;
  esac
done

need_cmd aws jq
need_cmd_report || exit 1

########################################################################
# Table plumbing
########################################################################
ROWS=()
leftovers=0   # anything that should not be there
guard_hits=0  # the subset that is actually expensive and running

# add_row <verdict> <resource> <count> <detail>
#   verdict: clean | leftover | expected | info | running
add_row() {
  ROWS+=("$1|$2|$3|$4")
  case "$1" in
    leftover) leftovers=$((leftovers + 1)) ;;
    running)  leftovers=$((leftovers + 1)); guard_hits=$((guard_hits + 1)) ;;
  esac
}

# count_lines <string>  - 0 for an empty string, N otherwise
count_lines() { [[ -z "$1" ]] && { printf '0'; return; }; grep -c . <<< "$1"; }

# first_few <string> - a short, single line summary for the table
first_few() {
  local n="${2:-3}"
  [[ -z "$1" ]] && { printf '-'; return; }
  tr '\n' ' ' <<< "$(head -n "$n" <<< "$1")" | sed 's/ *$//'
}

# aws_lines <description> <aws args...>
#   Runs an aws query that returns text, normalises tabs to newlines and
#   drops empties / None. Under DRY_RUN it prints the query and returns
#   nothing, so the script stays runnable with no credentials at all.
aws_lines() {
  local what="$1"; shift
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '%s  +%s aws %s %s(%s)%s\n' "$C_DIM" "$C_RST" "$(printf '%s ' "$@")" "$C_DIM" "$what" "$C_RST" >&2
    return 0
  fi
  aws "$@" --output text 2>/dev/null \
    | tr '\t' '\n' \
    | grep -vE '^(None)?$' || true
}

########################################################################
# The audit
########################################################################
banner "leftover audit for ${CLUSTER_NAME} in ${AWS_REGION}"

# -- 1. EKS clusters ---------------------------------------------------
clusters="$(aws_lines "eks clusters" eks list-clusters --query "clusters[?starts_with(@, 'agentflow')]")"
if [[ -n "$clusters" ]]; then
  add_row running "EKS cluster" "$(count_lines "$clusters")" "$(first_few "$clusters")"
else
  add_row clean "EKS cluster" 0 "-"
fi

# -- 2. EC2 instances --------------------------------------------------
instances="$( {
  aws_lines "instances by project tag" ec2 describe-instances \
    --filters "Name=tag:${PROJECT_TAG_KEY},Values=${PROJECT_TAG_VALUE}" \
              "Name=instance-state-name,Values=pending,running,stopping,stopped,shutting-down" \
    --query 'Reservations[].Instances[].InstanceId'
  aws_lines "instances by cluster tag" ec2 describe-instances \
    --filters "Name=tag-key,Values=${CLUSTER_TAG}" \
              "Name=instance-state-name,Values=pending,running,stopping,stopped,shutting-down" \
    --query 'Reservations[].Instances[].InstanceId'
} | sort -u)"
if [[ -n "$instances" ]]; then
  add_row running "EC2 instance" "$(count_lines "$instances")" "$(first_few "$instances")"
else
  add_row clean "EC2 instance" 0 "-"
fi

# -- 3. EBS volumes ----------------------------------------------------
volumes="$( {
  aws_lines "volumes by cluster tag" ec2 describe-volumes \
    --filters "Name=tag-key,Values=${CLUSTER_TAG}" --query 'Volumes[].VolumeId'
  aws_lines "volumes by project tag" ec2 describe-volumes \
    --filters "Name=tag:${PROJECT_TAG_KEY},Values=${PROJECT_TAG_VALUE}" --query 'Volumes[].VolumeId'
} | sort -u)"
if [[ -n "$volumes" ]]; then
  add_row leftover "EBS volume" "$(count_lines "$volumes")" "$(first_few "$volumes")"
else
  add_row clean "EBS volume" 0 "-"
fi

# -- 4. Load balancers (v2 and classic) --------------------------------
lb_v2=""
if [[ "$DRY_RUN" == "1" ]]; then
  aws_lines "elbv2" elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn' >/dev/null
else
  all_arns="$(aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn' --output text 2>/dev/null || true)"
  if [[ -n "$all_arns" && "$all_arns" != "None" ]]; then
    read -ra arn_list <<< "$all_arns"
    for arn in "${arn_list[@]}"; do
      if aws elbv2 describe-tags --resource-arns "$arn" \
           --query "TagDescriptions[0].Tags[?Key=='${CLUSTER_TAG}' || (Key=='${PROJECT_TAG_KEY}' && Value=='${PROJECT_TAG_VALUE}')].Key" \
           --output text 2>/dev/null | grep -q .; then
        lb_v2+="${arn##*/}"$'\n'
      fi
    done
  fi
fi

lb_classic=""
if [[ "$DRY_RUN" != "1" ]]; then
  names="$(aws elb describe-load-balancers --query 'LoadBalancerDescriptions[].LoadBalancerName' --output text 2>/dev/null || true)"
  if [[ -n "$names" && "$names" != "None" ]]; then
    read -ra name_list <<< "$names"
    for name in "${name_list[@]}"; do
      if aws elb describe-tags --load-balancer-names "$name" \
           --query "TagDescriptions[0].Tags[?Key=='${CLUSTER_TAG}'].Key" \
           --output text 2>/dev/null | grep -q .; then
        lb_classic+="${name}"$'\n'
      fi
    done
  fi
fi

lbs="$(printf '%s%s' "$lb_v2" "$lb_classic" | grep -v '^$' || true)"
if [[ -n "$lbs" ]]; then
  add_row running "Load balancer" "$(count_lines "$lbs")" "$(first_few "$lbs")"
else
  add_row clean "Load balancer" 0 "-"
fi

# -- 5. Elastic IPs. The classic silent bill: an allocated address that
#       is attached to nothing still costs money.
eips="$(aws_lines "elastic ips" ec2 describe-addresses \
  --filters "Name=tag:${PROJECT_TAG_KEY},Values=${PROJECT_TAG_VALUE}" \
  --query 'Addresses[].AllocationId')"
eips_free=""
if [[ -n "$eips" && "$DRY_RUN" != "1" ]]; then
  eips_free="$(aws ec2 describe-addresses \
    --filters "Name=tag:${PROJECT_TAG_KEY},Values=${PROJECT_TAG_VALUE}" \
    --query 'Addresses[?AssociationId==null].AllocationId' --output text 2>/dev/null \
    | tr '\t' '\n' | grep -vE '^(None)?$' || true)"
fi
if [[ -n "$eips" ]]; then
  detail="$(first_few "$eips")"
  [[ -n "$eips_free" ]] && detail+=" ($(count_lines "$eips_free") unassociated, billed hourly)"
  add_row leftover "Elastic IP" "$(count_lines "$eips")" "$detail"
else
  add_row clean "Elastic IP" 0 "-"
fi

# -- 6. Network interfaces --------------------------------------------
enis="$( {
  aws_lines "enis by cluster tag" ec2 describe-network-interfaces \
    --filters "Name=tag-key,Values=${CLUSTER_TAG}" --query 'NetworkInterfaces[].NetworkInterfaceId'
  aws_lines "enis by description" ec2 describe-network-interfaces \
    --filters "Name=description,Values=*${CLUSTER_NAME}*" --query 'NetworkInterfaces[].NetworkInterfaceId'
} | sort -u)"
if [[ -n "$enis" ]]; then
  add_row leftover "Network interface" "$(count_lines "$enis")" "$(first_few "$enis")"
else
  add_row clean "Network interface" 0 "-"
fi

# -- 7. Security groups ------------------------------------------------
sgs="$( {
  aws_lines "sgs by cluster tag" ec2 describe-security-groups \
    --filters "Name=tag-key,Values=${CLUSTER_TAG}" --query 'SecurityGroups[].GroupId'
  aws_lines "sgs by project tag" ec2 describe-security-groups \
    --filters "Name=tag:${PROJECT_TAG_KEY},Values=${PROJECT_TAG_VALUE}" --query 'SecurityGroups[].GroupId'
} | sort -u)"
if [[ -n "$sgs" ]]; then
  add_row leftover "Security group" "$(count_lines "$sgs")" "$(first_few "$sgs")"
else
  add_row clean "Security group" 0 "-"
fi

# -- 8. VPCs -----------------------------------------------------------
vpcs="$(aws_lines "vpcs" ec2 describe-vpcs \
  --filters "Name=tag:${PROJECT_TAG_KEY},Values=${PROJECT_TAG_VALUE}" --query 'Vpcs[].VpcId')"
if [[ -n "$vpcs" ]]; then
  add_row leftover "VPC" "$(count_lines "$vpcs")" "$(first_few "$vpcs")"
else
  add_row clean "VPC" 0 "-"
fi

# -- 9. RDS instances and snapshots -----------------------------------
dbs="$(aws_lines "rds instances" rds describe-db-instances \
  --query "DBInstances[?starts_with(DBInstanceIdentifier, 'agentflow')].DBInstanceIdentifier")"
if [[ -n "$dbs" ]]; then
  add_row running "RDS instance" "$(count_lines "$dbs")" "$(first_few "$dbs")"
else
  add_row clean "RDS instance" 0 "-"
fi

snaps="$(aws_lines "rds snapshots" rds describe-db-snapshots --snapshot-type manual \
  --query "DBSnapshots[?starts_with(DBSnapshotIdentifier, 'agentflow')].DBSnapshotIdentifier")"
if [[ -n "$snaps" ]]; then
  add_row leftover "RDS snapshot" "$(count_lines "$snaps")" "$(first_few "$snaps")"
else
  add_row clean "RDS snapshot" 0 "-"
fi

# -- 10. CloudWatch log groups ----------------------------------------
logs="$(aws_lines "log groups" logs describe-log-groups \
  --log-group-name-prefix "/aws/eks/${CLUSTER_NAME}" --query 'logGroups[].logGroupName')"
if [[ -n "$logs" ]]; then
  add_row leftover "Log group" "$(count_lines "$logs")" "$(first_few "$logs")"
else
  add_row clean "Log group" 0 "-"
fi

# -- 11. Secrets Manager ----------------------------------------------
#        app and ca belong to infra/bootstrap and must survive; db,
#        rabbitmq and grafana belong to the cluster and must not.
secrets="$(aws_lines "secrets" secretsmanager list-secrets \
  --filters "Key=name,Values=agentflow/demo" --query 'SecretList[].Name')"
if [[ -n "$secrets" ]]; then
  unexpected=""
  while read -r s; do
    [[ -z "$s" ]] && continue
    keep=0
    for k in "${KEEP_SECRETS[@]}"; do [[ "$s" == "$k" ]] && keep=1; done
    [[ "$keep" == "0" ]] && unexpected+="${s}"$'\n'
  done <<< "$secrets"
  unexpected="$(grep -v '^$' <<< "$unexpected" || true)"
  if [[ -n "$unexpected" ]]; then
    add_row leftover "Secrets Manager" "$(count_lines "$unexpected")" "$(first_few "$unexpected")"
  else
    add_row expected "Secrets Manager" "$(count_lines "$secrets")" "app + ca (bootstrap, kept on purpose)"
  fi
else
  add_row clean "Secrets Manager" 0 "-"
fi

# -- 12. KMS keys pending deletion ------------------------------------
#        Informational: a key in PendingDeletion costs nothing and goes
#        away on its own, but its presence says a cluster was torn down.
kms_pending=""
if [[ "$DRY_RUN" == "1" ]]; then
  aws_lines "kms aliases" kms list-aliases --query 'Aliases[].AliasName' >/dev/null
else
  aliases="$(aws kms list-aliases --query 'Aliases[].AliasName' --output text 2>/dev/null || true)"
  while read -r alias; do
    [[ -z "$alias" ]] && continue
    case "$alias" in
      *agentflow*|*eks*"${CLUSTER_NAME}"*) ;;
      *) continue ;;
    esac
    state="$(aws kms describe-key --key-id "$alias" --query 'KeyMetadata.KeyState' --output text 2>/dev/null || true)"
    [[ "$state" == "PendingDeletion" ]] && kms_pending+="${alias}"$'\n'
  done < <(printf '%s' "$aliases" | tr '\t' '\n')
  kms_pending="$(grep -v '^$' <<< "$kms_pending" || true)"
fi
if [[ -n "$kms_pending" ]]; then
  add_row info "KMS pending deletion" "$(count_lines "$kms_pending")" "$(first_few "$kms_pending")"
else
  add_row clean "KMS pending deletion" 0 "-"
fi

# -- 13. Terraform state bucket: expected, never a leftover ------------
if [[ "$DRY_RUN" != "1" ]]; then
  account="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
  if [[ -n "$account" && "$account" != "None" ]] \
     && aws s3api head-bucket --bucket "agentflow-tfstate-${account}" >/dev/null 2>&1; then
    add_row expected "State bucket" 1 "agentflow-tfstate-${account} (bootstrap, kept on purpose)"
  fi
fi

########################################################################
# Report
########################################################################
printf '\n'
printf '  %-26s %6s  %s\n' "RESOURCE" "COUNT" "DETAIL"
printf '  %-26s %6s  %s\n' "--------------------------" "-----" "------------------------------"
for row in "${ROWS[@]}"; do
  IFS='|' read -r verdict resource count detail <<< "$row"
  case "$verdict" in
    clean)    colour="$C_GRN"; mark="ok  " ;;
    expected) colour="$C_BLU"; mark="keep" ;;
    info)     colour="$C_DIM"; mark="info" ;;
    running)  colour="$C_RED"; mark="RUN " ;;
    *)        colour="$C_YEL"; mark="LEFT" ;;
  esac
  printf '  %s%-4s%s %-21s %6s  %s\n' "$colour" "$mark" "$C_RST" "$resource" "$count" "$detail"
done
printf '\n'

if [[ "$DRY_RUN" == "1" ]]; then
  ok "dry run: the queries above are read-only and were not executed"
  exit 0
fi

if [[ "$GUARD" == "1" ]]; then
  if [[ "$guard_hits" -gt 0 ]]; then
    err "${guard_hits} expensive resource group(s) still running"
    err "run \`make aws-down\` (or re-run the guard workflow with auto_destroy)"
    exit 1
  fi
  ok "guard: no cluster, load balancer, RDS instance or EC2 instance is running"
  exit 0
fi

if [[ "$leftovers" -gt 0 ]]; then
  err "${leftovers} leftover resource group(s); every line marked LEFT or RUN costs money"
  err "delete them, or re-run \`make aws-down\` if the cluster is still up"
  exit 1
fi

ok "nothing left except the bootstrap stack (state bucket, agentflow/demo/{app,ca})"
