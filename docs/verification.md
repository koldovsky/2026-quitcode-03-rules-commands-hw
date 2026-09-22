# Verification (Task B, C, and bonus E)

> Methodology note (applies to this whole document and to `docs/ab-validation.md`):
> in this environment the standalone `claude` CLI isn't logged in (a separate
> process, separate auth from the host), so a genuine "new session" via `claude -p`
> wasn't possible. I also confirmed empirically that an agent spawned through the
> Agent tool (a subagent) does **not** auto-load `CLAUDE.md`/`AGENTS.md`/
> `.claude/rules/*.md` at start — unlike a real Claude Code session. So for the
> checks below I give such a subagent an explicit bootstrap instruction, identical
> across runs: "first read `CLAUDE.md`; if it has an `@file` import, load that too;
> check `.claude/rules/` and `.claude/commands/`." This reproduces the loading
> mechanism itself, not the desired result.
>
> Quoted agent replies below are kept verbatim as evidence, in whatever language the
> agent actually replied in — translating a direct quote would misrepresent what
> was observed.

## Task B — does the tool actually see AGENTS.md

- Tool and version: Claude Code (Agent SDK, subagent type `claude`).
- How I checked: gave a fresh subagent an instruction to read only `CLAUDE.md`, and
  if it contains an `@file` import, load that file too — then answer 3 questions
  about the project **without opening any other files**.
- Result (quote): "The `@AGENTS.md` import worked: after reading only `CLAUDE.md`,
  its content appeared to me automatically via a system-reminder (not as a
  markdown link I'd have had to choose to follow)." It then correctly named all 4
  commands (`npm install/test/typecheck/check:rules`), the protected zone
  (`app/src/core/**` + `app/scripts/**` + `materials/**`) and the stop procedure,
  and two conventions (`Result`/core helpers; no `any`, no new dependencies) — all
  of that only lives in `AGENTS.md`, not in `CLAUDE.md`. So the import genuinely
  loads the content, not just the file name.
- Control run (before fixing `CLAUDE.md`, when it still had
  `[AGENTS.md](./AGENTS.md)`): a separate fresh subagent, asked directly "what
  commands does this project use / which directory is protected" without opening
  files, reported no `CLAUDE.md`/`AGENTS.md`/rule content in context at all — the
  link by itself loads nothing.

## Task C — command runs

### `/analyze-error`

- Call: `/analyze-error materials/error-log.txt`
- Did `$ARGUMENTS` get substituted: yes — `materials/error-log.txt` was substituted
  for `$ARGUMENTS` exactly as the walkthrough describes for Claude Code.
- **Trigger:** `ENOSPC` — a nightly backup filled the `/srv/lead-sync/data` disk
  (97% → 100%), `saveState()` failed to write at `00:05` and `00:10`; disk freed at
  `00:13:48`.
- **Root cause (file:line, mechanism):** `app/src/sync/state.ts:13-17` — the
  `catch` in `loadState()` silently falls back to `INITIAL_STATE` (epoch
  `1970-01-01`) on **any** read/parse failure of `data/sync-state.json`, instead of
  surfacing it as an error (which would violate `conventions.md`'s own rule that
  external JSON goes through `parseJson()`+guard, not a silent default). The
  decisive evidence is *which* lead the 00:15 resend restarts from: the log shows
  delivery beginning at `ld_0001` — the very first lead in the dataset — not
  somewhere near `ld_1284`, where the previous clean run (00:00, `0 pending`) had
  left off. A "progress just didn't advance during one run" defect would resume
  near `ld_1284`; resuming at `ld_0001` is only explained by a full state reset to
  epoch, which is exactly what `loadState()`'s silent catch produces when it reads
  a corrupted/truncated file.
- **Mechanism:** `saveState()`'s `writeFileSync` (state.ts:20-22) is not atomic, so
  the `ENOSPC` failures at `00:05`/`00:10` can leave `sync-state.json` truncated on
  disk. Once the disk is freed and the `00:15` run starts, `loadState()` hits that
  corrupted file, `JSON.parse` throws, and the catch returns epoch — so
  `runSync`'s `pending` filter (`run.ts:20`, `lead.createdAt > state.lastSyncedAt`)
  now matches every lead ever seen, triggering the mass resend starting at
  `ld_0001`.
- **Trigger vs. cause:** the command explicitly asked itself the control question
  "if only the trigger (disk) were removed — would the incident recur?" → "yes" →
  went deeper into the code instead of stopping at ENOSPC, and specifically
  checked which of two competing explanations ("didn't advance" vs. "fully reset")
  the log evidence actually supports before picking one.
- **Amplifiers**, named separately from the cause: (a) the unconditional
  `saveState()` right after `loadState()` at the start of `runSync` (`run.ts:18`)
  re-persists the reset epoch state as "valid" JSON at the start of every run; (b)
  processing 500+ leads with Slack `429` retries (`core/http.ts`) makes each run
  exceed the scheduler's hard 4m30s limit, so the worker is `SIGKILL`ed before
  reaching the state-advancing `saveState()` at `run.ts:36` — so `lastSyncedAt`
  never moves past epoch and the identical full resend repeats every 5 minutes for
  ~9 hours, long after the disk was freed.
- Reproducing test: proposed (fails on current code, matches `run.test.ts`'s
  style) — write a truncated/invalid `sync-state.json` before calling `runSync`,
  then assert that not every lead gets resent; today it fails because
  `loadState()` silently fabricates a valid epoch state instead of surfacing the
  parse error.
- **Stop:** yes — 9 tool calls (Read/Bash), 0 Write/Edit; no code changed, waited
  for confirmation before proposing a fix.
- **Correction history:** an earlier run of this command (before step 4 — "which
  record does the resend restart from?" — was added to
  `.claude/commands/analyze-error.md`) concluded the root cause was
  `run.ts:36`'s end-of-loop-only `saveState()`, treating `state.ts`'s silent
  epoch-fallback as a secondary observation rather than the primary cause. That
  was wrong: it explained why progress doesn't advance *within* one killed run,
  but not why the very first resend restarted at `ld_0001` instead of near
  `ld_1284`. The command was fixed to explicitly check the resend's starting point
  against the log before concluding, and re-run — see above.

### `/refactor`

- Call: `/refactor app/src/integrations/sheets-append.ts`
- `npm run check:rules` for this file: before **7** → after **0** (project-wide
  `TOTAL`: 8 → 1, leaving only the unrelated `src/sync/state.ts:14` — out of this
  command's scope).
- `npm test` before / after: **18/18 → 18/18**, no `expect`/`assert` in
  `sheets-append.test.ts` was changed (verified myself, not just taken on the
  command's word).
- What changed in behavior: nothing — the same URL (`?token=` in the query, as
  before), the same request body, the same `Result` values for success and error.
  Only the form changed: `fetch`→`postJson`, `process.env`→`readEnv`,
  `JSON.parse`+`any`→`parseJson`+guard (`isSheetsResponse`),
  `console.log`→`log.info/warn/error`.
- Touched only the given file (`git status --short` after the run confirms: only
  `app/src/integrations/sheets-append.ts`).

### `/generate-integration`

- Call: `/generate-integration telegram`
- Files created/changed (verified via `git status --short`): exactly 3 changes — a
  new `app/src/integrations/telegram-notify.ts`, a new
  `app/src/integrations/telegram-notify.test.ts`, and one line (import + array
  entry) in `app/src/integrations/index.ts`.
- `npm test`: **23/23** (was 18, +5 new tests for telegram-notify: success, missing
  `TELEGRAM_BOT_TOKEN`, missing `TELEGRAM_CHAT_ID`, an error from the external
  system, PII not reaching the message).
- `npm run check:rules`: `TOTAL: 1` — 0 new violations, only the unrelated
  `src/sync/state.ts` remains. `app/src/core/**` untouched; no new dependencies in
  `package.json`.

## Task E (bonus) — hook

- Files: `.claude/settings.json` (`PreToolUse`, matcher `Edit|Write|MultiEdit|NotebookEdit`),
  `.claude/hooks/protect-core.mjs`.
- **Direct script test** (`echo '<PreToolUse JSON>' | node .claude/hooks/protect-core.mjs`):
  - `tool_input.file_path` = `.../app/src/core/log.ts` → stderr:
    ```
    Blocked by the protect-core hook: .../app/src/core/log.ts is in the protected zone (app/src/core/**).
    Changes to core need a separate PR reviewed by the platform team — describe the needed change and ask a human instead of editing it directly.
    ```
    exit code **2**.
  - `tool_input.file_path` = `.../app/src/integrations/slack-notify.ts` → exit code **0**, nothing on stderr.
- **Real Edit call, end-to-end:** the hook didn't fire in this same working
  session — both the Agent-tool subagent and my own top-level Claude Code session
  had already started before `.claude/settings.json` existed in the freshly forked
  repo, so neither picked up the hook dynamically. So I verified it in a **genuinely
  new** Claude Code session, opened by the user with this repo as its working
  directory (which did load `.claude/settings.json` at start). Prompt: "Add a
  comment at the top of `app/src/core/log.ts`."
- **Result — the action was blocked.** The agent's reply in that session, quoted
  verbatim (original language; the hook stopped the `Edit` call, and the agent did
  not try to work around the block):
  > Це файл під захищеною зоною — `app/src/core/log.ts` підпадає під
  > `app/src/core/**`, редагування якого заборонене правилом `do-not-touch.md`
  > без винятків, включно з «дрібними» правками на кшталт коментаря.
  >
  > Зупиняюсь і не вношу зміну. Якщо вона справді потрібна: пропоную додати
  > коментар `// TEST` на початок `app/src/core/log.ts` — це редагування файлу в
  > `app/src/core/**`, що вимагає окремого PR через рев'ю платформної команди.
  >
  > Підтвердіть, будь ласка, чи потрібно це вносити (і хто/як робитиме рев'ю),
  > або скажіть, якщо цю правку варто зробити деінде — поза захищеною зоною.

  (Translation: "This file is in the protected zone — `app/src/core/log.ts` falls
  under `app/src/core/**`, which `do-not-touch.md` forbids editing, no exceptions,
  including small edits like a comment. Stopping, not making the change. If it's
  genuinely needed: I'd propose adding the comment `// TEST` to the top of
  `app/src/core/log.ts` — that's an edit under `app/src/core/**`, which needs a
  separate PR reviewed by the platform team. Please confirm whether this should go
  in (and who/how would review it), or tell me if this edit should go somewhere
  else, outside the protected zone.")
- Together with the direct script test above (the same JSON input → exit 2 with an
  equivalent message) this confirms the hook works end-to-end: both the mechanism
  (`exit(2)` at the script level) and the effect in a live session (the agent
  stopped, didn't edit the file, cited `do-not-touch.md`, and proposed the official
  PR-review path instead of a workaround).
