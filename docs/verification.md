# Verification (Task B, C, and bonus E)

> Methodology note (applies to this whole document and to `docs/ab-validation.md`):
> in this environment the standalone `claude` CLI isn't logged in (a separate
> process, separate auth from the host), so a genuine "new session" via `claude -p`
> wasn't available to me directly. I also confirmed empirically that an agent
> spawned through the Agent tool (a subagent) does **not** auto-load
> `CLAUDE.md`/`AGENTS.md`/`.claude/rules/*.md` at start — unlike a real Claude Code
> session. Where a check below is still based on such a subagent (with an explicit
> bootstrap instruction standing in for real session boot), that's noted
> explicitly. Wherever possible, the participant instead opened a genuinely new
> Claude Code session by hand and ran the check there — that evidence supersedes
> the subagent version and is the one that counts.
>
> Quoted agent replies below are kept verbatim as evidence, in whatever language the
> agent actually replied in — translating a direct quote would misrepresent what
> was observed.

## Task B — does the tool actually see AGENTS.md

- Tool and version: Claude Code, genuinely new session opened by the participant
  in this repo (not a subagent — see the correction below).
- How I checked: in a fresh session, asked "List the project rules you currently
  have in context, without opening any files."
- **Result (quote, real new session):**
  > Protected Zones (do-not-touch)
  > - Do not edit, create, or delete under: `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**`
  > - Applies to any task, no exceptions
  >
  > Code Conventions (from AGENTS.md)
  > 1. Error handling: Use `Result` instead of exceptions
  > 2. Utilities: Use `postJson`, `readEnv`, `parseJson`+guard, `log`
  > 3. Type safety: No `any` types
  > 4. Dependencies: No new runtime dependencies
  > 5. Notifications: Slack messages must not include lead email or phone
  > 6. File names: kebab-case; integration `name` field must match file name
  >
  > Architecture & Layers
  > - Dependency direction and core's public API rules exist in `.claude/rules/architecture.md` (in context but details not shown)
  >
  > Project Structure
  > - `app/src/core/` — shared platform core (protected)
  > - `app/src/integrations/` — external system modules + registry
  > - `app/src/sync/` — sync run and state management
  >
  > Before Committing
  > ```
  > cd app && npm test && npm run typecheck && npm run check:rules
  > ```
  >
  > Note: The full details of `architecture.md` and `conventions.md` are
  > referenced but not loaded in the current context.
- **This is stronger evidence than "the import loads something" — it shows the
  applies-to modes working exactly as designed:** `AGENTS.md` (loaded via
  `@AGENTS.md`, always-on) and `do-not-touch.md` (no `paths`, always-on) are fully
  in context from session start; `architecture.md`/`conventions.md` (`paths:
  app/src/**/*.ts`) are known to exist (correctly summarized from AGENTS.md's own
  one-line pointers) but their own file content is **not** loaded — because the
  session hadn't touched any `app/src/**` file yet. That's the intended
  path-scoped behavior, not a bug: a session that never touches `app/src/` never
  pays the context cost of those two rule files.
- **Correction:** an earlier version of this check used a subagent (Agent tool)
  instructed to read `CLAUDE.md` and follow its `@AGENTS.md` import by hand. That
  proved the import mechanism works (the subagent got `AGENTS.md`'s content
  without opening it directly), but it does **not** prove that a real Claude Code
  session auto-loads project memory at session start, since a subagent was told
  what to do rather than booting on its own. The result above, from a genuinely
  new session with zero instructions about what to check, replaces that as the
  authoritative evidence for Task B.

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
- **Real Edit call, end-to-end (attempt 1, rules present):** the hook didn't fire
  in this same working session — both the Agent-tool subagent and my own
  top-level Claude Code session had already started before `.claude/settings.json`
  existed in the freshly forked repo, so neither picked up the hook dynamically.
  So I verified it in a **genuinely new** Claude Code session, opened by the user
  with this repo as its working directory (which did load `.claude/settings.json`
  at start). Prompt: "Add a comment at the top of `app/src/core/log.ts`."
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
- **Caveat on attempt 1 (flagged by review):** the agent's reply cites
  `do-not-touch.md`, not the hook — so attempt 1 alone doesn't prove the `Edit`
  call actually reached the hook; the agent may simply have refused on its own,
  from the rule text, without ever calling the tool. Confirming the hook itself
  needs a run with the rule text absent.
- **Real Edit call, end-to-end (attempt 2, isolated — rules off, hook on):**
  another genuinely new session, this time with `CLAUDE.md`, `AGENTS.md`,
  `.claude/rules/` and `.claude/commands/` all renamed to `.off` — only
  `.claude/settings.json` + `.claude/hooks/protect-core.mjs` present, so
  `do-not-touch.md` was not in context at all. Same prompt. First reply just read
  the file and asked what kind of comment to add (`Read` isn't covered by the
  hook's matcher, so that step goes through); replying "`// TEST`" made it call
  `Edit`, which is when the hook fired. Quoted verbatim:
  > Failed to edit log.ts
  > Не можу додати коментар напряму — файл у захищеній зоні (`app/src/core/**`).
  > Згідно з `protect-core` hook, для змін до core файлів потрібна окрема PR, яка
  > буде переглянута командою платформи.
  > Опис зміни для PR:
  > - Додати коментар `// TEST` на початку файлу app/src/core/log.ts
  > Створити PR для цієї зміни?

  (Translation: "Failed to edit log.ts. Can't add the comment directly — the file
  is in the protected zone (`app/src/core/**`). Per the `protect-core` hook,
  changes to core files need a separate PR reviewed by the platform team.
  Change description for the PR: add the comment `// TEST` to the top of
  `app/src/core/log.ts`. Create a PR for this change?")
- This is the decisive result: with no rule text in context to reason from, the
  agent still names **`protect-core hook`** by name and reports the `Edit` call
  itself as failed — proof the tool call reached the hook and was denied at the
  mechanism level, not just talked out of by rule text.
- Together with the direct script test above (the same JSON input → exit 2 with an
  equivalent message) this confirms the hook works end-to-end: both the mechanism
  (`exit(2)` at the script level) and the effect in a live session, isolated from
  rule text (the agent's `Edit` call was denied, it reported the hook by name, and
  proposed the official
  PR-review path instead of a workaround).
