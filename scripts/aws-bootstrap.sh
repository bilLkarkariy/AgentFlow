#!/usr/bin/env bash
#
# Applies infra/bootstrap (the once-per-account stack) and fills the two
# Secrets Manager shells it creates.
#
# Terraform owns the containers, this script owns the values: nothing secret
# ever reaches a state file, a plan output or this script's stdout.
#
#   ALERT_EMAIL=you@example.com scripts/aws-bootstrap.sh
#   DRY_RUN=1 ALERT_EMAIL=you@example.com scripts/aws-bootstrap.sh
#   scripts/aws-bootstrap.sh -y --migrate-state
#
# Run it once. `make aws-up` / `make aws-down` never touch this stack.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_DIR="${REPO_ROOT}/infra/bootstrap"
BACKEND_FILE="${STACK_DIR}/backend.tf"

ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"
CA_DIR="${CA_DIR:-${HOME}/.agentflow/ca}"
CA_KEY="${CA_DIR}/ca.key"
CA_CRT="${CA_DIR}/ca.crt"

SECRET_APP="agentflow/demo/app"
SECRET_CA="agentflow/demo/ca"
STATE_KEY="bootstrap/terraform.tfstate"
DEMO_STATE_KEY="aws-demo/terraform.tfstate"

DRY_RUN="${DRY_RUN:-0}"
ASSUME_YES=0
MIGRATE_STATE=0

########################################################################
# Plumbing
########################################################################

say()  { printf 'aws-bootstrap: %s\n' "$*"; }
warn() { printf 'aws-bootstrap: %s\n' "$*" >&2; }
die()  { printf 'aws-bootstrap: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: scripts/aws-bootstrap.sh [options]

Applies infra/bootstrap and pushes the values of agentflow/demo/{app,ca}.

Options:
  -y, --yes             terraform apply -auto-approve (no interactive plan)
      --migrate-state   move this stack's own state into the new S3 bucket
      --dry-run         print the commands instead of running them (= DRY_RUN=1)
  -h, --help            this text

Environment:
  ALERT_EMAIL           address for AWS Budgets / anomaly alerts (required;
                        TF_VAR_alert_email works too, otherwise you are asked)
  ENV_FILE              source of agentflow/demo/app  (default: <repo>/.env)
  CA_DIR                where the demo root CA lives  (default: ~/.agentflow/ca)
  DRY_RUN=1             same as --dry-run
EOF
}

# Runs a command, or prints it in dry-run mode.
run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '  + %s\n' "$(printf '%q ' "$@")"
    return 0
  fi
  "$@"
}

# Reads a terraform output, or a placeholder in dry-run mode.
tf_output() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '<%s>' "$1"
    return 0
  fi
  terraform -chdir="$STACK_DIR" output -raw "$1"
}

TMP_DIR=""
cleanup() { [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"; return 0; }
trap cleanup EXIT

########################################################################
# Arguments
########################################################################

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)       ASSUME_YES=1 ;;
    --migrate-state) MIGRATE_STATE=1 ;;
    --dry-run)      DRY_RUN=1 ;;
    -h|--help)      usage; exit 0 ;;
    *)              usage >&2; die "unknown argument: $1" ;;
  esac
  shift
done

########################################################################
# Preflight
########################################################################

preflight() {
  local missing=() bin
  for bin in terraform aws jq openssl; do
    command -v "$bin" >/dev/null 2>&1 || missing+=("$bin")
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    warn "missing tool(s): ${missing[*]}"
    die  "brew install ${missing[*]} (terraform: brew install hashicorp/tap/terraform)"
  fi

  [[ -d "$STACK_DIR" ]] || die "no such directory: ${STACK_DIR}"

  if [[ "$DRY_RUN" == "1" ]]; then
    say "dry run: not calling AWS, not writing anything"
    return 0
  fi

  local identity
  if ! identity="$(aws sts get-caller-identity --output json 2>/dev/null)"; then
    warn "no usable AWS credentials."
    die  "run 'aws configure' (or 'aws sso login') first. This script never asks for keys."
  fi

  say "account $(jq -r '.Account' <<<"$identity"), identity $(jq -r '.Arn' <<<"$identity")"
}

# ALERT_EMAIL -> TF_VAR_alert_email, asked interactively as a last resort.
resolve_alert_email() {
  if [[ -n "${TF_VAR_alert_email:-}" ]]; then
    :
  elif [[ -n "${ALERT_EMAIL:-}" ]]; then
    TF_VAR_alert_email="$ALERT_EMAIL"
  elif [[ -t 0 ]]; then
    read -r -p "aws-bootstrap: address for AWS budget alerts: " TF_VAR_alert_email
  else
    die "set ALERT_EMAIL=you@example.com (or TF_VAR_alert_email) and run again"
  fi

  [[ "$TF_VAR_alert_email" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] \
    || die "'${TF_VAR_alert_email}' does not look like an e-mail address"

  export TF_VAR_alert_email
  say "budget alerts go to ${TF_VAR_alert_email}"
}

########################################################################
# 1. Terraform
########################################################################

apply_stack() {
  run terraform -chdir="$STACK_DIR" init -input=false

  local apply_args=(-input=false)
  if [[ "$ASSUME_YES" == "1" ]]; then
    apply_args+=(-auto-approve)
  else
    say "review the plan and answer 'yes' (use -y to skip this)"
  fi

  run terraform -chdir="$STACK_DIR" apply "${apply_args[@]}"
}

########################################################################
# 2. Private root CA
#
# Generated once and kept outside the repo. Regenerating it invalidates
# every machine that ran `make aws-trust-ca`, so the file wins over a
# fresh key every time.
########################################################################

ensure_ca() {
  if [[ -f "$CA_KEY" && -f "$CA_CRT" ]]; then
    say "reusing the CA already in ${CA_DIR}"
    return 0
  fi

  say "generating a demo root CA in ${CA_DIR} (P-256, 10 years)"
  run mkdir -p "$CA_DIR"
  run chmod 700 "$CA_DIR"
  # openssl 3 already adds `basicConstraints=critical,CA:TRUE`; keyUsage is
  # spelled out so strict verifiers (Go's crypto/x509, macOS keychain) accept
  # the certificates cert-manager will sign with it.
  run openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
    -nodes -days 3650 \
    -subj "/CN=AgentFlow Demo Root CA" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -keyout "$CA_KEY" -out "$CA_CRT"
  run chmod 600 "$CA_KEY"
}

########################################################################
# 3. Secret values
#
# The payload always travels as a file, never as an argv string: argv is
# world-readable through `ps`.
########################################################################

put_secret() {
  local secret_id="$1" payload_file="$2" label="$3"

  if [[ "$DRY_RUN" == "1" ]]; then
    printf '  + aws secretsmanager put-secret-value --secret-id %s --secret-string file://%s   # %s\n' \
      "$secret_id" "$payload_file" "$label"
    return 0
  fi

  aws secretsmanager put-secret-value \
    --secret-id "$secret_id" \
    --secret-string "file://${payload_file}" \
    --query VersionId --output text >/dev/null

  say "pushed ${label} to ${secret_id}"
}

push_ca_secret() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '  + jq -n --rawfile crt %s --rawfile key %s (object tls.crt + tls.key) > %s\n' \
      "$CA_CRT" "$CA_KEY" "${TMP_DIR}/ca.json"
    put_secret "$SECRET_CA" "${TMP_DIR}/ca.json" "root CA (tls.crt + tls.key)"
    return 0
  fi

  local payload="${TMP_DIR}/ca.json"
  # --rawfile is `jq -Rs` applied to a file: it keeps the PEM newlines and
  # does the JSON escaping, which no amount of shell quoting would.
  jq -n \
    --rawfile crt "$CA_CRT" \
    --rawfile key "$CA_KEY" \
    '{"tls.crt": $crt, "tls.key": $key}' > "$payload"

  put_secret "$SECRET_CA" "$payload" "root CA (tls.crt + tls.key)"
}

# .env -> {"KEY": "value", ...}, skipping blanks, comments and empty values.
read -r -d '' ENV_TO_JSON <<'JQ' || true
def unquote:
  if test("^\".*\"$") or test("^'.*'$") then .[1:-1] else . end;
[ inputs
  | sub("^[[:space:]]*export[[:space:]]+"; "")
  | select(test("^[A-Za-z_][A-Za-z0-9_]*="))
  | capture("^(?<k>[A-Za-z_][A-Za-z0-9_]*)=(?<v>.*)$")
  | .v |= (unquote | sub("[[:space:]]+$"; ""))
  | select(.v != "")
  | { (.k): .v }
]
| add // {}
JQ

push_app_secret() {
  if [[ "$DRY_RUN" == "1" ]]; then
    if [[ -f "$ENV_FILE" ]]; then
      printf '  + jq -Rn <env-to-json filter> < %s > %s\n' "$ENV_FILE" "${TMP_DIR}/app.json"
    else
      printf '  + write the placeholder {OPENAI_API_KEY: changeme} to %s (no %s)\n' \
        "${TMP_DIR}/app.json" "$ENV_FILE"
    fi
    put_secret "$SECRET_APP" "${TMP_DIR}/app.json" "application environment"
    return 0
  fi

  local payload="${TMP_DIR}/app.json"

  if [[ -f "$ENV_FILE" ]]; then
    jq -Rn "$ENV_TO_JSON" < "$ENV_FILE" > "$payload"
  else
    printf '{}' > "$payload"
  fi

  # An empty object would make the api start with no OPENAI_API_KEY and fail
  # on the first agent run with a confusing error. A placeholder fails loudly.
  if [[ "$(jq -r 'length' "$payload")" == "0" ]]; then
    warn "no usable KEY=VALUE line in ${ENV_FILE} (or the file is missing)"
    warn "  pushing {\"OPENAI_API_KEY\":\"changeme\"} - agent runs will fail until you fix it"
    jq -n '{"OPENAI_API_KEY": "changeme"}' > "$payload"
  fi

  # Key names only. Never the values.
  say "agentflow/demo/app keys: $(jq -r 'keys | join(", ")' "$payload")"
  put_secret "$SECRET_APP" "$payload" "application environment"
}

########################################################################
# 4. Optional: move this stack's state into the bucket it just created
########################################################################

enable_backend_block() {
  if grep -qE '^[[:space:]]*backend[[:space:]]+"s3"' "$BACKEND_FILE"; then
    say "backend.tf: the s3 backend block is already active"
    return 0
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    printf '  + uncomment the s3 backend block in %s\n' "$BACKEND_FILE"
    return 0
  fi

  local rewritten="${TMP_DIR}/backend.tf"
  awk '
    /^# <<< backend-s3/ { inblock = 0 }
    inblock && /^#/     { sub(/^#[[:space:]]?/, "") }
                        { print }
    /^# >>> backend-s3/ { inblock = 1 }
  ' "$BACKEND_FILE" > "$rewritten"

  cp "$rewritten" "$BACKEND_FILE"
  say "backend.tf: uncommented the s3 backend block"
}

migrate_state() {
  local bucket region
  bucket="$(tf_output state_bucket)"
  region="$(tf_output region)"

  enable_backend_block

  local init_args=(
    -input=false
    -migrate-state
    -backend-config="bucket=${bucket}"
    -backend-config="region=${region}"
    -backend-config="key=${STATE_KEY}"
    -backend-config="use_lockfile=true"
    -backend-config="encrypt=true"
  )
  [[ "$ASSUME_YES" == "1" ]] && init_args+=(-force-copy)

  run terraform -chdir="$STACK_DIR" init "${init_args[@]}"
  say "state now lives at s3://${bucket}/${STATE_KEY}"
  say "the local infra/bootstrap/terraform.tfstate backup is gitignored; delete it once you trust the move"
}

########################################################################
# 5. Summary
########################################################################

print_summary() {
  local bucket region role_arn
  bucket="$(tf_output state_bucket)"
  region="$(tf_output region)"
  role_arn="$(tf_output github_actions_role_arn)"

  cat <<EOF

────────────────────────────────────────────────────────────────────────
Bootstrap done.

  state bucket   ${bucket}
  region         ${region}
  CI role        ${role_arn}
  secrets        ${SECRET_APP}, ${SECRET_CA}
  private CA     ${CA_DIR}

Init the demo stack with:

  terraform -chdir=infra/envs/aws-demo init \\
    -backend-config="bucket=${bucket}" \\
    -backend-config="region=${region}" \\
    -backend-config="key=${DEMO_STATE_KEY}" \\
    -backend-config="use_lockfile=true" \\
    -backend-config="encrypt=true"

(that is what \`make aws-up\` runs for you)

Two things only you can do:
  1. accept the AWS Cost Anomaly Detection confirmation mail sent to
     ${TF_VAR_alert_email:-<alert_email>}; until then the anomaly alerts stay silent
  2. create the GitHub environment 'aws-demo' (required reviewer) and set
     its variable AWS_ROLE_ARN to the CI role above
────────────────────────────────────────────────────────────────────────
EOF
}

########################################################################
# main
########################################################################

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/agentflow-bootstrap.XXXXXX")"
chmod 700 "$TMP_DIR"

preflight
resolve_alert_email
apply_stack
ensure_ca
push_ca_secret
push_app_secret

if [[ "$MIGRATE_STATE" == "1" ]]; then
  migrate_state
fi

print_summary

if [[ "$DRY_RUN" == "1" ]]; then
  say "dry run: nothing above was executed"
fi
