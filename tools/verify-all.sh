#!/usr/bin/env bash
# Одна кнопка для всього Definition of Done цієї домашки.
#   bash tools/verify-all.sh
# exit 0 — усе зелене; exit 1 — перший провал видно у виводі.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
step() {
  printf '\n\033[1m── %s\033[0m\n' "$1"; shift
  if "$@"; then printf '   ✓ ok\n'; else printf '   ✗ FAIL\n'; fail=1; fi
}

step "тести застосунку"        bash -c 'cd app && npm test'
step "типи"                    bash -c 'cd app && npm run typecheck'
step "конвенції (check:rules)" bash -c 'cd app && npm run check:rules'
step "правила ↔ код"           node tools/check-rule-claims.mjs --quiet
step "хук: спроби обходу"      bash -c 'node .claude/hooks/test-protect-core.mjs | tail -1'
step "захищені шляхи не змінені" bash -c '
  changed=$(git status --porcelain -- app/src/core app/scripts materials .github .coderabbit.yaml)
  if [ -n "$changed" ]; then echo "$changed"; exit 1; fi; echo "порожньо"'

printf '\n'
[ "$fail" -eq 0 ] && echo "VERIFY-ALL: зелено" || echo "VERIFY-ALL: є провали"
exit "$fail"
