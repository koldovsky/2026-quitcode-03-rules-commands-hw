#!/usr/bin/env bash
# Один прогін A/B у СВІЖІЙ сесії Claude Code, з повним транскриптом.
#
#   bash tools/ab-run.sh <arm> <model> [<шлях до файлу із запитом>]
#   arm: b-off | b-off-nobrief | a-on | a-hook
#
# Навіщо скрипт, а не «відкрив нову вкладку й вставив запит». Прогони мають
# відрізнятися РІВНО однією річчю. Руками це не відтворюється: інший порядок
# уточнень, інша відповідь на питання агента, забуте перейменування. Тут усе
# фіксовано, а транскрипт JSONL дає точні числа замість «приблизно стільки
# файлів прочитав».
#
# Що вимикається в кожному прогоні (див. docs/walkthrough.md, Task D):
#   b-off          правила, команди, AGENTS.md, CLAUDE.md, хуки
#   b-off-nobrief  те саме + materials/architecture-brief.md (проєкт без записки)
#   a-on           правила, команди, спільна база — УВІМКНЕНО; хуки вимкнено
#   a-hook         усе увімкнено, разом із PreToolUse-хуком
set -uo pipefail
cd "$(dirname "$0")/.."

ARM="${1:?arm: b-off | b-off-nobrief | a-on | a-hook}"
MODEL="${2:-opus}"
TASK_FILE="${3:-materials/ab-task.md}"
STAMP="${ARM}--${MODEL}"
OUT="docs/evidence/ab/${STAMP}"
mkdir -p "$OUT"

# Запит — рівно текст між лініями у materials/ab-task.md, без жодних змін.
PROMPT="$(awk '/^---$/{n++; next} n==1' "$TASK_FILE" | sed '/^$/d')"
[ -z "$PROMPT" ] && { echo "порожній запит із $TASK_FILE"; exit 1; }

# Приховане ВИНОСИТЬСЯ ЗА МЕЖІ РЕПОЗИТОРІЮ, а не перейменовується в `.off`.
# Чому: перейменований файл лишається на диску й читається. У першому прогоні
# b-off-nobrief агент відкрив `.claude/rules.off/do-not-touch.md` і
# `.claude/rules.off/conventions.md` — тобто «прогін без правил» вимірював
# правила. Доказ: docs/evidence/ab/_first-attempt-leak/.
HIDE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ws03-ab-hidden.XXXXXX")"
hide() {
  mkdir -p "$HIDE_DIR"          # restore_all міг його прибрати
  [ -e "$1" ] || return 0
  local dest="$HIDE_DIR/$(printf '%s' "$1" | tr '/' '~')"
  mv "$1" "$dest" && echo "  винесено з репо: $1"
}
show() {
  local src="$HIDE_DIR/$(printf '%s' "$1" | tr '/' '~')"
  [ -e "$src" ] && mkdir -p "$(dirname "$1")" && mv "$src" "$1"
  return 0
}

ALL=(CLAUDE.md AGENTS.md .claude/rules .claude/commands .claude/settings.json .cursor/hooks.json materials/architecture-brief.md)
restore_all() { for p in "${ALL[@]}"; do show "$p"; done; }
trap 'restore_all; rmdir "$HIDE_DIR" 2>/dev/null || true' EXIT

echo "═══ прогін ${STAMP} ═══"
echo "── чистий старт"
git reset -q; git checkout -q -- app; git clean -qfd app
restore_all

echo "── конфігурація прогону"
case "$ARM" in
  b-off)         hide CLAUDE.md; hide AGENTS.md; hide .claude/rules; hide .claude/commands; hide .claude/settings.json; hide .cursor/hooks.json ;;
  b-off-nobrief) hide CLAUDE.md; hide AGENTS.md; hide .claude/rules; hide .claude/commands; hide .claude/settings.json; hide .cursor/hooks.json; hide materials/architecture-brief.md ;;
  a-on)          hide .claude/settings.json; hide .cursor/hooks.json ;;   # хуки off в обох прогонах: міряємо правила, не хук
  a-hook)        : ;;                                                      # усе увімкнено
  *) echo "невідомий arm: $ARM"; exit 1 ;;
esac

echo "── контроль ізоляції"
# Прогін недійсний, якщо те, що мало бути сховане, лишилось читабельним у репо.
# Перша спроба саме так і зіпсувалась: див. docs/evidence/ab/_first-attempt-leak/.
case "$ARM" in
  b-off|b-off-nobrief) MUST_BE_GONE=(CLAUDE.md AGENTS.md .claude/rules .claude/commands .claude/settings.json) ;;
  a-on)                MUST_BE_GONE=(.claude/settings.json) ;;
  a-hook)              MUST_BE_GONE=() ;;
esac
[ "$ARM" = "b-off-nobrief" ] && MUST_BE_GONE+=(materials/architecture-brief.md)
LEAK=""
for p in "${MUST_BE_GONE[@]:-}"; do [ -n "$p" ] && [ -e "$p" ] && LEAK="$LEAK $p"; done
STRAY=$(ls -d ./*.off .claude/*.off .cursor/*.off materials/*.off 2>/dev/null | tr '\n' ' ')
printf 'мало бути сховано:%s\nзалишки .off у репо: %s\n' "${LEAK:- нічого не лишилось}" "${STRAY:-немає}" | tee "$OUT/isolation.txt"
if [ -n "$LEAK" ] || [ -n "$STRAY" ]; then
  echo "✗ ПРОГІН НЕДІЙСНИЙ: агент зміг би прочитати$LEAK $STRAY"; exit 1
fi

echo "── базова лінія"
(cd app && npm run --silent check:rules | tail -1) | tee "$OUT/check-rules.before.txt"

echo "── запуск claude (модель $MODEL)"
START=$(date +%s)
printf '%s\n' "$PROMPT" > "$OUT/prompt.txt"
claude -p "$PROMPT" \
  --model "$MODEL" \
  --output-format stream-json --verbose \
  --permission-mode bypassPermissions \
  --setting-sources project \
  --strict-mcp-config \
  --max-turns 80 \
  < /dev/null > "$OUT/transcript.jsonl" 2> "$OUT/stderr.txt"
echo "  claude exit=$? за $(( $(date +%s) - START ))s"

echo "── результат"
(cd app && npm test 2>&1 | tail -6) > "$OUT/npm-test.after.txt"; tail -3 "$OUT/npm-test.after.txt"
(cd app && npm run --silent check:rules) > "$OUT/check-rules.after.txt"; tail -1 "$OUT/check-rules.after.txt"
git status --short -- app > "$OUT/git-status.txt"; cat "$OUT/git-status.txt"
git add -N app >/dev/null 2>&1
git diff --output="$OUT/app.diff" -- app
git reset -q

node tools/ab-report.mjs "$OUT" > "$OUT/summary.md"
node tools/transcript-md.mjs "$OUT" >/dev/null
gzip -f "$OUT/transcript.jsonl"
echo "── звіт: $OUT/summary.md"
cat "$OUT/summary.md"
