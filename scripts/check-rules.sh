#!/usr/bin/env bash
#
# Validate every PrometheusRule shipped by the platform with promtool.
#
# `promtool check rules` expects a plain Prometheus rule file, so the
# .spec of each PrometheusRule is extracted into a temporary file first.
#
# Usage: scripts/check-rules.sh [directory ...]
#        default directory: deploy/platform/monitoring-config
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIRS=("$@")
if [ ${#DIRS[@]} -eq 0 ]; then
  DIRS=("${REPO_ROOT}/deploy/platform/monitoring-config")
fi

for tool in promtool yq; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "error: ${tool} is required (brew install prometheus yq)" >&2
    exit 1
  fi
done

TMPDIR_RULES="$(mktemp -d)"
trap 'rm -rf "${TMPDIR_RULES}"' EXIT

checked=0
failed=0

# Every YAML file under the given directories, PrometheusRule or not:
# the yq filter below decides.
while IFS= read -r -d '' file; do
  # A single file may hold several documents; index them so multi-doc
  # files do not overwrite each other.
  doc=0
  while IFS= read -r kind; do
    if [ "${kind}" = "PrometheusRule" ]; then
      name="$(yq "select(documentIndex == ${doc}) | .metadata.name // \"unnamed\"" "${file}")"
      out="${TMPDIR_RULES}/$(basename "${file%.yaml}")-${doc}.rules.yaml"
      yq "select(documentIndex == ${doc}) | .spec" "${file}" >"${out}"

      printf '==> %s (%s)\n' "${file#"${REPO_ROOT}/"}" "${name}"
      if promtool check rules "${out}"; then
        checked=$((checked + 1))
      else
        failed=$((failed + 1))
      fi
    fi
    doc=$((doc + 1))
  done < <(yq 'select(. != null) | .kind // ""' "${file}")
done < <(find "${DIRS[@]}" -type f \( -name '*.yaml' -o -name '*.yml' \) -print0)

if [ "${checked}" -eq 0 ] && [ "${failed}" -eq 0 ]; then
  echo "error: no PrometheusRule found under ${DIRS[*]}" >&2
  exit 1
fi

printf '\n%d PrometheusRule(s) checked, %d failed\n' "$((checked + failed))" "${failed}"
[ "${failed}" -eq 0 ]
