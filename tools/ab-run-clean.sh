#!/usr/bin/env bash
# Чесний контрольний прогін: копія проєкту БЕЗ git-історії.
#
#   bash tools/ab-run-clean.sh <clean-off|clean-on> <model>
#
# Навіщо ще один стенд. Перейменування правил у `.off` лишає їх читабельними на
# диску; винесення за межі репо лишає їх у git. У прогоні b-off-nobrief--sonnet
# агент дістав правила командою `git show HEAD:.claude/rules/do-not-touch.md`
# (доказ: docs/evidence/ab/b-off-nobrief--sonnet/transcript.md). Тому «без
# правил» у репозиторії з історією виміряти неможливо в принципі.
#
# Тут копіюється лише код застосунку — так виглядає звичайний клієнтський
# проєкт, куди агента пускають уперше: є код і його перевірка, немає ні
# архітектурної записки, ні правил, ні історії комітів.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD"
ARM="${1:?clean-off | clean-on}"; MODEL="${2:-opus}"
OUT="docs/evidence/ab/${ARM}--${MODEL}"; mkdir -p "$OUT"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ws03-clean.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

echo "═══ прогін ${ARM}--${MODEL} (копія без git) ═══"
mkdir -p "$WORK/app"
cp -R app/src app/scripts app/package.json app/package-lock.json app/tsconfig.json "$WORK/app/"
ln -s "$REPO/app/node_modules" "$WORK/app/node_modules"
if [ "$ARM" = "clean-on" ]; then
  cp -R .claude "$WORK/"; rm -rf "$WORK/.claude/hooks" "$WORK/.claude/settings.json"
  cp AGENTS.md CLAUDE.md "$WORK/"
  echo "  правила й спільна база скопійовані, хук — ні"
else
  echo "  нічого, крім коду застосунку"
fi

echo "── що агент бачить у корені:"; ls -a "$WORK" | grep -v '^\.$\|^\.\.$' | sed 's/^/     /'
echo "── git у копії: $( [ -d "$WORK/.git" ] && echo "Є — ПОМИЛКА" || echo "немає ✓" )"
{ ls -a "$WORK"; echo "git: $( [ -d "$WORK/.git" ] && echo yes || echo no )"; } > "$OUT/isolation.txt"

PROMPT="$(awk '/^---$/{n++; next} n==1' materials/ab-task.md | sed '/^$/d')"
printf '%s\n' "$PROMPT" > "$OUT/prompt.txt"
(cd "$WORK/app" && npm run --silent check:rules | tail -1) > "$OUT/check-rules.before.txt"

( cd "$WORK" && claude -p "$PROMPT" --model "$MODEL" --output-format stream-json --verbose \
    --permission-mode bypassPermissions --setting-sources project --strict-mcp-config \
    --max-turns 80 < /dev/null ) > "$OUT/transcript.jsonl" 2> "$OUT/stderr.txt"
echo "  claude exit=$?"

(cd "$WORK/app" && npm run --silent check:rules) > "$OUT/check-rules.after.txt"
(cd "$WORK/app" && npm test 2>&1 | tail -6) > "$OUT/npm-test.after.txt"
diff -ru "$REPO/app/src" "$WORK/app/src" > "$OUT/app.diff" 2>&1
diff -q "$REPO/app/scripts/core.lock.json" "$WORK/app/scripts/core.lock.json" > "$OUT/git-status.txt" 2>&1 \
  && echo "core.lock.json не змінено" > "$OUT/git-status.txt"
diff -rq "$REPO/app/src" "$WORK/app/src" 2>&1 | sed 's/^/  /' >> "$OUT/git-status.txt"

node tools/ab-report.mjs "$OUT" > "$OUT/summary.md"
node tools/transcript-md.mjs "$OUT" >/dev/null
gzip -f "$OUT/transcript.jsonl"
grep -E '^\| (check:rules|npm test|файлів проч|змінював|ходів|вартість)' "$OUT/summary.md"
echo "── змінені файли:"; cat "$OUT/git-status.txt"
