#!/usr/bin/env bash
set -Eeuo pipefail
mkdir -p security-reports
: > security-reports/summary.txt
export PATH="$HOME/.local/bin:$HOME/go/bin:$PATH"
echo "Installing security scanners"
python -m pip install --disable-pip-version-check "semgrep>=1.100,<2" "schemathesis>=4,<5"
mkdir -p "$HOME/.local/bin"
trivy_version="v0.76.0"
curl -fsSL "https://raw.githubusercontent.com/aquasecurity/trivy/${trivy_version}/contrib/install.sh" | sh -s -- -b "$HOME/.local/bin" "$trivy_version"
gitleaks_version="8.30.1"
gitleaks_path="$(mktemp)"
trap 'rm -f "$gitleaks_path"' EXIT
curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${gitleaks_version}/gitleaks_${gitleaks_version}_linux_x64.tar.gz" -o "$gitleaks_path"
echo "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb  $gitleaks_path" | sha256sum --check --status
tar --no-same-owner -xz -C "$HOME/.local/bin" -f "$gitleaks_path" gitleaks
echo "Running independent security scans"
failed=0
run_check() {
  local name="$1"; shift
  echo "=== $name ==="
  if "$@"; then
    printf '%s: PASS\n' "$name" >> security-reports/summary.txt
  else
    rc=$?
    printf '%s: FAIL (exit %s)\n' "$name" "$rc" >> security-reports/summary.txt
    failed=1
  fi
}
run_check semgrep semgrep scan --config p/security-audit --config p/owasp-top-ten --error --exclude node_modules --exclude dist --exclude build --json --output security-reports/semgrep.json .
run_check gitleaks gitleaks git --redact --exit-code 1 --report-format json --report-path security-reports/gitleaks.json
run_check trivy trivy fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL --exit-code 1 --format json --output security-reports/trivy.json .
# Network testing is opt-in and must target an owned isolated staging system.
if [ "${SECURITY_ACTIVE_SCAN_APPROVED:-}" = "YES_STAGING_ONLY" ] && [ -n "${SECURITY_STAGING_URL:-}" ]; then
  case "$SECURITY_STAGING_URL" in
    https://*staging*|https://*test*|https://*preview*) ;;
    *) echo "Refusing unapproved target"; exit 2;;
  esac
  run_check nuclei_install go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@v3.4.10
  if command -v nuclei >/dev/null 2>&1; then
    run_check nuclei nuclei -u "$SECURITY_STAGING_URL" -severity medium,high,critical -rate-limit 2 -concurrency 2 -jsonl -o security-reports/nuclei.jsonl
  fi
  if [ -n "${SECURITY_OPENAPI_URL:-}" ]; then
    run_check schemathesis schemathesis run "$SECURITY_OPENAPI_URL" --max-examples 5 --rate-limit 2/s
  fi
else
  printf 'Active staging scans: SKIPPED (approval/URL absent)\n' >> security-reports/summary.txt
fi
cat security-reports/summary.txt
exit "$failed"
