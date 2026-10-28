#!/bin/sh
# Renders the SPA runtime configuration served at /config.js.
#
# Every APP_<KEY> environment variable becomes a <KEY> entry of window.__APP_CONFIG__,
# e.g. APP_API_BASE_URL=http://api -> window.__APP_CONFIG__.API_BASE_URL === 'http://api'.
#
# Runs from /docker-entrypoint.d as uid 101 and only writes under $RUNTIME_DIR
# (default /tmp/runtime), so the container works with a read-only root filesystem.
# RUNTIME_DIR is overridable to make the script testable outside a container.

set -eu

ME=$(basename "$0")
RUNTIME_DIR="${RUNTIME_DIR:-/tmp/runtime}"
RUNTIME_FILE="${RUNTIME_DIR}/config.js"

entrypoint_log() {
    if [ -z "${NGINX_ENTRYPOINT_QUIET_LOGS:-}" ]; then
        echo "$ME: $*"
    fi
}

# JSON-escapes a value. There is no jq in the image: sed handles backslash, double
# quote, tab and carriage return, awk folds embedded newlines into \n.
json_escape() {
    printf '%s' "$1" \
        | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r/\\r/g' \
        | awk 'BEGIN { ORS = "" } { if (NR > 1) print "\\n"; print }'
}

mkdir -p "$RUNTIME_DIR"

# Names only, so that values containing newlines cannot be mistaken for extra entries.
names=$(awk 'END { for (name in ENVIRON) if (name ~ /^APP_[A-Za-z0-9_]+$/) print name }' </dev/null | sort)

tmp_file="${RUNTIME_FILE}.tmp"
{
    printf 'window.__APP_CONFIG__ = {'
    first=1
    for name in $names; do
        eval "value=\${$name}"
        if [ "$first" -eq 1 ]; then
            printf '\n'
            first=0
        else
            printf ',\n'
        fi
        # shellcheck disable=SC2154  # `value` is assigned by the eval above.
        printf '  "%s": "%s"' "${name#APP_}" "$(json_escape "$value")"
    done
    [ "$first" -eq 1 ] || printf '\n'
    printf '};\n'
} >"$tmp_file"
mv "$tmp_file" "$RUNTIME_FILE"

entrypoint_log "wrote $RUNTIME_FILE"
