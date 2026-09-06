# shellcheck shell=bash
########################################################################
# Shared helpers for the AWS lifecycle scripts (WP13).
#
# Sourced, never executed:
#
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
#
# What it gives you:
#   log / ok / warn / die        one-line, colour-aware output
#   need_cmd                     collect every missing tool, fail once
#   run                          execute, or print under DRY_RUN=1
#   capture                      same, but the caller wants stdout
#   confirm                      interactive gate, skipped with -y / CI
#   phase / phase_end / elapsed  wall-clock timing per step
#   retry                        n attempts with a fixed pause
#   aws_account_id / aws_region  identity, cached
#   tf_out                       one Terraform output, from a cached -json
#
# DRY_RUN=1 is a contract, not a debug flag: every script here must be
# runnable end to end with DRY_RUN=1 and no AWS credentials, printing the
# exact command sequence it would have executed.
########################################################################

# Guard against double sourcing (aws-up.sh sources this and then calls
# aws-render-env.sh, which sources it again).
if [[ -n "${AGENTFLOW_COMMON_SH:-}" ]]; then
  return 0
fi
AGENTFLOW_COMMON_SH=1

# --------------------------------------------------------------------
# Environment defaults. Every script may override them before sourcing.
# --------------------------------------------------------------------
: "${DRY_RUN:=0}"
: "${ASSUME_YES:=0}"
: "${CI:=false}"
: "${AWS_REGION:=eu-west-1}"
: "${AWS_DEFAULT_REGION:=$AWS_REGION}"
: "${CLUSTER_NAME:=agentflow-demo}"
: "${KUBE_CONTEXT_AWS:=agentflow-aws}"
: "${TF_DIR:=infra/envs/aws-demo}"
: "${SESSION_DIR:=${HOME}/.agentflow}"
export AWS_REGION AWS_DEFAULT_REGION

# Repository root, whichever directory the caller stands in.
REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export REPO_ROOT

# --------------------------------------------------------------------
# Colours only on a terminal, so CI logs and `| tee` stay readable.
# --------------------------------------------------------------------
if [[ -t 1 ]]; then
  C_RED=$'\033[31m'; C_YEL=$'\033[33m'; C_GRN=$'\033[32m'
  C_BLU=$'\033[34m'; C_DIM=$'\033[2m';  C_BLD=$'\033[1m'; C_RST=$'\033[0m'
else
  C_RED=''; C_YEL=''; C_GRN=''; C_BLU=''; C_DIM=''; C_BLD=''; C_RST=''
fi

# Prefix every line with the script that produced it: aws-up.sh calls
# aws-render-env.sh, and the interleaved output has to stay readable.
_tag() { printf '%s' "${LOG_TAG:-$(basename "${0:-agentflow}" .sh)}"; }

log()  { printf '%s%-16s%s %s\n' "$C_DIM" "$(_tag)" "$C_RST" "$*"; }
ok()   { printf '%s%-16s%s %sok%s   %s\n' "$C_DIM" "$(_tag)" "$C_RST" "$C_GRN" "$C_RST" "$*"; }
warn() { printf '%s%-16s%s %swarn%s %s\n' "$C_DIM" "$(_tag)" "$C_RST" "$C_YEL" "$C_RST" "$*" >&2; }
err()  { printf '%s%-16s%s %sfail%s %s\n' "$C_DIM" "$(_tag)" "$C_RST" "$C_RED" "$C_RST" "$*" >&2; }
die()  { err "$*"; exit 1; }

# A visible separator; the AWS scripts are long and mostly waiting.
banner() {
  printf '\n%s%s== %s ==%s\n' "$C_BLD" "$C_BLU" "$*" "$C_RST"
}

# --------------------------------------------------------------------
# Tools
# --------------------------------------------------------------------
# Collect every missing binary and fail once with the whole list, rather
# than making the operator run the script five times.
_missing_cmds=()

need_cmd() {
  local bin
  for bin in "$@"; do
    command -v "$bin" >/dev/null 2>&1 || _missing_cmds+=("$bin")
  done
}

need_cmd_report() {
  [[ ${#_missing_cmds[@]} -eq 0 ]] && return 0
  err "missing tool(s): ${_missing_cmds[*]}"
  err "install them with: brew install ${_missing_cmds[*]}"
  return 1
}

# --------------------------------------------------------------------
# Command execution
# --------------------------------------------------------------------
# Print a command the way a human would retype it.
_quote_cmd() {
  local out='' arg
  for arg in "$@"; do
    if [[ "$arg" =~ ^[A-Za-z0-9_@%+=:,./-]+$ ]]; then
      out+="${arg} "
    else
      out+="'${arg//\'/\'\\\'\'}' "
    fi
  done
  printf '%s' "${out% }"
}

# run <cmd> [args...]
#   DRY_RUN=1 -> print, return 0
#   otherwise -> execute, propagate the exit status
run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '%s  +%s %s\n' "$C_DIM" "$C_RST" "$(_quote_cmd "$@")"
    return 0
  fi
  "$@"
}

# capture <fallback> <cmd> [args...]
#   Same as `run`, but the caller consumes stdout. Under DRY_RUN the
#   command is printed on stderr and <fallback> is echoed, so a dry run
#   keeps flowing with a plausible value instead of an empty string.
capture() {
  local fallback="$1"; shift
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '%s  +%s %s %s(-> %s)%s\n' \
      "$C_DIM" "$C_RST" "$(_quote_cmd "$@")" "$C_DIM" "$fallback" "$C_RST" >&2
    printf '%s\n' "$fallback"
    return 0
  fi
  "$@"
}

# retry <attempts> <sleep_seconds> <cmd> [args...]
retry() {
  local attempts="$1" pause="$2"; shift 2
  local n=1
  while :; do
    if "$@"; then
      return 0
    fi
    if [[ "$n" -ge "$attempts" ]]; then
      return 1
    fi
    warn "attempt ${n}/${attempts} failed: $(_quote_cmd "$@") - retrying in ${pause}s"
    n=$((n + 1))
    sleep "$pause"
  done
}

# --------------------------------------------------------------------
# Confirmation
# --------------------------------------------------------------------
# confirm <question>
#   Returns 0 to proceed. Skipped when the caller passed -y/--yes
#   (ASSUME_YES=1) or when running in CI, where there is no tty to read.
confirm() {
  local question="$1"
  if [[ "$ASSUME_YES" == "1" || "${CI}" == "true" ]]; then
    log "${question} -> yes (non-interactive)"
    return 0
  fi
  if [[ ! -t 0 ]]; then
    die "${question} - no terminal to ask on; pass -y if you mean it"
  fi
  local reply
  read -r -p "$(printf '%s%s%s [y/N] ' "$C_BLD" "$question" "$C_RST")" reply
  [[ "$reply" == "y" || "$reply" == "Y" || "$reply" == "yes" ]]
}

# --------------------------------------------------------------------
# Timing. `make aws-up` takes ~25 min; knowing which phase ate the time
# is the difference between "it is slow" and "EKS control plane: 9 min".
# --------------------------------------------------------------------
_phase_start=0
_run_start="$(date +%s)"

fmt_duration() {
  local s="$1"
  printf '%dm%02ds' "$((s / 60))" "$((s % 60))"
}

phase() {
  _phase_start="$(date +%s)"
  banner "$*"
}

phase_end() {
  local now; now="$(date +%s)"
  local d=$((now - _phase_start))
  printf '%s%-16s%s %s(%s)%s\n' \
    "$C_DIM" "$(_tag)" "$C_RST" "$C_DIM" "$(fmt_duration "$d")" "$C_RST"
}

elapsed() {
  local now; now="$(date +%s)"
  fmt_duration "$((now - _run_start))"
}

# --------------------------------------------------------------------
# Waiting
# --------------------------------------------------------------------
# wait_for <timeout_seconds> <interval> <description> <cmd> [args...]
#   Polls <cmd> until it succeeds. Prints one dot per round so a 10 min
#   wait does not look like a hang. Returns 1 on timeout.
wait_for() {
  local timeout="$1" interval="$2" what="$3"; shift 3
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '%s  +%s wait up to %ss for %s\n' "$C_DIM" "$C_RST" "$timeout" "$what"
    printf '%s  +%s   %s\n' "$C_DIM" "$C_RST" "$(_quote_cmd "$@")"
    return 0
  fi
  local deadline=$(( $(date +%s) + timeout ))
  log "waiting for ${what} (up to $(fmt_duration "$timeout"))"
  while :; do
    if "$@"; then
      ok "${what}"
      return 0
    fi
    if [[ "$(date +%s)" -ge "$deadline" ]]; then
      err "timed out after $(fmt_duration "$timeout") waiting for ${what}"
      return 1
    fi
    printf '%s.%s' "$C_DIM" "$C_RST"
    sleep "$interval"
  done
}

# --------------------------------------------------------------------
# AWS helpers. None of them ever print or store a credential.
# --------------------------------------------------------------------
_aws_account_id_cache=""

aws_account_id() {
  if [[ -n "$_aws_account_id_cache" ]]; then
    printf '%s\n' "$_aws_account_id_cache"
    return 0
  fi
  local id
  id="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
  if [[ -z "$id" || "$id" == "None" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
      id="000000000000"
    else
      return 1
    fi
  fi
  _aws_account_id_cache="$id"
  printf '%s\n' "$id"
}

aws_region() { printf '%s\n' "$AWS_REGION"; }

# The name of the Terraform state bucket, which is account scoped.
state_bucket() {
  local account
  account="$(aws_account_id)" || return 1
  printf 'agentflow-tfstate-%s\n' "$account"
}

# --------------------------------------------------------------------
# Terraform outputs
# --------------------------------------------------------------------
# tf_out <name> [tf_dir]
#   Reads `terraform output -json` once per process and caches it in a
#   temp file, because aws-up.sh asks for eight different outputs and each
#   call would otherwise re-read the remote state.
#   A list output is returned as one comma separated line.
_tf_out_cache=""

tf_out_json() {
  local dir="${1:-$TF_DIR}"
  if [[ -n "$_tf_out_cache" && -s "$_tf_out_cache" ]]; then
    printf '%s\n' "$_tf_out_cache"
    return 0
  fi
  _tf_out_cache="$(mktemp -t agentflow-tfout)"
  if ! terraform -chdir="$dir" output -json > "$_tf_out_cache" 2>/dev/null; then
    rm -f "$_tf_out_cache"
    _tf_out_cache=""
    return 1
  fi
  printf '%s\n' "$_tf_out_cache"
}

tf_out() {
  local name="$1" dir="${2:-$TF_DIR}" file
  file="$(tf_out_json "$dir")" || return 1
  jq -r --arg n "$name" '
    .[$n].value
    | if type == "array" then join(",")
      elif type == "object" then tojson
      elif . == null then ""
      else tostring end
  ' "$file"
}

# --------------------------------------------------------------------
# Session file: written by aws-up.sh, read by aws-cost / aws-down to say
# how long the cluster has been burning money. Lives outside the repo on
# purpose - it is machine state, not source.
# --------------------------------------------------------------------
session_file() { printf '%s/session\n' "$SESSION_DIR"; }

session_write() {
  local domain="$1"
  mkdir -p "$SESSION_DIR"
  {
    printf 'started_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'started_epoch=%s\n' "$(date +%s)"
    printf 'cluster=%s\n' "$CLUSTER_NAME"
    printf 'region=%s\n' "$AWS_REGION"
    printf 'domain=%s\n' "$domain"
  } > "$(session_file)"
  chmod 600 "$(session_file)"
}

session_get() {
  local key="$1" file
  file="$(session_file)"
  [[ -f "$file" ]] || return 1
  sed -n "s/^${key}=//p" "$file" | head -n 1
}

session_clear() {
  local file
  file="$(session_file)"
  [[ -f "$file" ]] && rm -f "$file"
  return 0
}
