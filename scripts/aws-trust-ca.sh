#!/usr/bin/env bash
#
# Teaches this machine to trust the AgentFlow demo CA, so
# https://api.<eip>.sslip.io opens without a browser warning.
#
#   make aws-trust-ca                    # add it to the login keychain
#   scripts/aws-trust-ca.sh --remove     # take it back out
#   scripts/aws-trust-ca.sh --fetch      # pull the certificate first
#
# Why a private CA at all: the demo domain is <eip>.sslip.io, which
# changes with the Elastic IPs and cannot get a Let's Encrypt certificate
# worth the rate limit. ACM would need Route 53 and a real domain. So
# scripts/aws-bootstrap.sh generates one CA, stores it in Secrets Manager
# (agentflow/demo/ca), and every cluster gets it back through External
# Secrets - the CA outlives the cluster, which is exactly why trusting it
# once is worth it.
#
# Only the certificate is ever touched here. The private key stays in
# Secrets Manager; this script never reads it and never writes it.
#
set -euo pipefail

LOG_TAG="aws-trust-ca"
# shellcheck source=scripts/lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

CA_DIR="${CA_DIR:-${HOME}/.agentflow/ca}"
CA_CRT="${CA_DIR}/ca.crt"
KEYCHAIN="${KEYCHAIN:-${HOME}/Library/Keychains/login.keychain-db}"
SECRET_CA="agentflow/demo/ca"

REMOVE=0
FETCH=0

usage() {
  cat <<'EOF'
Usage: scripts/aws-trust-ca.sh [--remove] [--fetch] [--dry-run]

  --remove    remove the demo CA from the trust store
  --fetch     (re)download the certificate from Secrets Manager first
  --dry-run   print the commands instead of running them

Environment: CA_DIR (default ~/.agentflow/ca), KEYCHAIN (macOS login keychain)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remove) REMOVE=1; shift ;;
    --fetch) FETCH=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "unknown argument: $1"; usage >&2; exit 2 ;;
  esac
done

########################################################################
# Get the certificate
########################################################################
fetch_ca() {
  need_cmd aws jq
  need_cmd_report || exit 1
  log "reading the certificate (not the key) from ${SECRET_CA}"
  if [[ "$DRY_RUN" == "1" ]]; then
    run mkdir -p "$CA_DIR"
    run aws secretsmanager get-secret-value --secret-id "$SECRET_CA" --query SecretString
    log "would write the tls.crt field to ${CA_CRT}"
    return 0
  fi
  mkdir -p "$CA_DIR"
  local crt
  crt="$(aws secretsmanager get-secret-value --secret-id "$SECRET_CA" \
    --query SecretString --output text 2>/dev/null | jq -r '."tls.crt" // empty')"
  [[ -n "$crt" ]] || die "could not read tls.crt from ${SECRET_CA}; run \`make aws-bootstrap\` first"
  printf '%s\n' "$crt" > "$CA_CRT"
  chmod 644 "$CA_CRT"
  ok "wrote ${CA_CRT}"
}

if [[ "$FETCH" == "1" ]]; then
  fetch_ca
fi

if [[ ! -f "$CA_CRT" && "$DRY_RUN" != "1" && "$REMOVE" == "0" ]]; then
  warn "no certificate at ${CA_CRT}"
  if confirm "Download it from Secrets Manager (${SECRET_CA})?"; then
    fetch_ca
  else
    die "nothing to trust; run \`make aws-bootstrap\` or pass --fetch"
  fi
fi

########################################################################
# Trust it
########################################################################
case "$(uname -s)" in
  Darwin)
    need_cmd security
    need_cmd_report || exit 1

    if [[ "$REMOVE" == "1" ]]; then
      banner "removing the demo CA from the login keychain"
      # `remove-trusted-cert` drops the trust setting; the certificate
      # itself is then deleted from the keychain.
      run security remove-trusted-cert -d "$CA_CRT" || true
      run security delete-certificate -c "AgentFlow Demo Root CA" "$KEYCHAIN" || true
      ok "the browser will warn about https://*.sslip.io again"
      exit 0
    fi

    banner "trusting the demo CA in the login keychain"
    log "macOS asks for your password: adding a root certificate is a real"
    log "trust decision, and it applies to this user account only"
    # -d  add to the admin (system) trust domain for this user
    # -r trustRoot  trust it as a root, not just as a leaf
    # -k <keychain> the login keychain, so no sudo and no machine-wide change
    run security add-trusted-cert -d -r trustRoot -k "$KEYCHAIN" "$CA_CRT"
    ok "certificate trusted"
    printf '\n  Restart the browser, then open https://api.<domain> without a warning.\n'
    printf '  Undo it any time with: scripts/aws-trust-ca.sh --remove\n\n'
    ;;

  Linux)
    banner "Linux: trust the CA yourself"
    cat <<EOF

  This script only automates macOS. On Linux, as root:

    sudo cp ${CA_CRT} /usr/local/share/ca-certificates/agentflow-demo-ca.crt
    sudo update-ca-certificates                       # Debian / Ubuntu
    # or
    sudo cp ${CA_CRT} /etc/pki/ca-trust/source/anchors/agentflow-demo-ca.crt
    sudo update-ca-trust                              # Fedora / RHEL

  Firefox keeps its own store: Settings > Privacy & Security >
  View Certificates > Authorities > Import.

  To undo, delete the file you copied and run the same update command.

EOF
    exit 0
    ;;

  *)
    die "unsupported platform $(uname -s); trust ${CA_CRT} by hand"
    ;;
esac
