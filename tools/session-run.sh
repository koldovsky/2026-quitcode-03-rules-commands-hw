#!/usr/bin/env bash
# Прогін у свіжій сесії Claude Code з повним транскриптом.
#   bash tools/session-run.sh <назва> <модель> "<запит>"
# Кладе транскрипт і звіт у docs/evidence/<назва>/.
set -uo pipefail
cd "$(dirname "$0")/.."
NAME="${1:?потрібна назва прогону}"; MODEL="${2:-opus}"; PROMPT="${3:?потрібен запит}"
OUT="docs/evidence/$NAME"; mkdir -p "$OUT"
printf '%s\n' "$PROMPT" > "$OUT/prompt.txt"
git status --short > "$OUT/git-status.before.txt"
(cd app && npm run --silent check:rules) > "$OUT/check-rules.before.txt" 2>&1
(cd app && npm test 2>&1 | tail -5) > "$OUT/npm-test.before.txt"
START=$(date +%s)
claude -p "$PROMPT" --model "$MODEL" --output-format stream-json --verbose \
  --permission-mode bypassPermissions --setting-sources project \
  --strict-mcp-config --max-turns 80 \
  < /dev/null > "$OUT/transcript.jsonl" 2> "$OUT/stderr.txt"
echo "claude exit=$? за $(( $(date +%s) - START ))s"
(cd app && npm run --silent check:rules) > "$OUT/check-rules.after.txt" 2>&1
(cd app && npm test 2>&1 | tail -5) > "$OUT/npm-test.after.txt"
git status --short > "$OUT/git-status.after.txt"
node tools/ab-report.mjs "$OUT" > "$OUT/summary.md"
node tools/transcript-md.mjs "$OUT" >/dev/null
# Сирий JSONL теж іде в публічний репозиторій — прибрати локальні шляхи
# ДО стиснення, інакше вони лишаться в архіві (рев'ю CodeRabbit, PR #4).
node tools/redact.mjs --file "$OUT/transcript.jsonl"
gzip -f "$OUT/transcript.jsonl"
cat "$OUT/summary.md"
