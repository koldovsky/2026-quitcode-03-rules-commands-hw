---
description: Find an incident's root cause from a log file — not just the trigger
argument-hint: <path to log file>
---

# analyze-error

**Target:** $ARGUMENTS
(If there's no file path above, the target is in the message right after the
command name. Not there either — ask and stop.)

## Steps

1. Read the given log in full and build a timeline of events (timestamps,
   INFO/WARN/ERROR/SYSTEM levels), without skipping over "... N similar lines
   skipped ...".
2. Find the **trigger** — the first event that's externally visible as "something
   broke" (e.g. an error in the log, a client complaint).
3. Separate the trigger from the **root cause**: the trigger is what started it; the
   cause is why the effects continued or repeated after the trigger was gone.
   Explicitly ask yourself: "if only the trigger were removed (e.g. free up the
   disk) — would the incident recur?" If the answer is "yes" — dig deeper, into the
   code, not the infrastructure.
4. If the log shows a mass resend/duplicate pattern, pin down exactly which record
   the resend restarts from and compare it against the timeline right before the
   incident. "Restarts from wherever it last got stuck" (an amplifier — progress
   simply didn't advance during one run) is a different defect than "restarts from
   the very first record in the whole dataset" (state was fully reset — e.g. a
   silent fallback to an initial/epoch value on a read or parse failure). Don't
   stop at the first plausible mechanism you find — check which one the log
   evidence actually supports.
5. Find the cause in the project's code (`app/src/`): a specific file and line, and
   the mechanism — exactly how the code misbehaves under these conditions.
6. Propose a test that reproduces the problem (fails on the current code, no real
   network — per `.claude/rules/conventions.md`).
7. Summarize for the human: trigger → root cause (file:line) → mechanism →
   proposed test. If there are obvious "amplifiers" of the problem, name them
   separately.

## Acceptance criteria

- [ ] Trigger and root cause are named separately and not conflated.
- [ ] The root cause points to a specific file and line of code.
- [ ] The proposed test reproduces the problem (a diagnostic snippet is fine, it
      doesn't have to be committed).
- [ ] No project file was changed.

## Stop

Do not change code. Show the report and the plan (trigger / cause / mechanism /
test) and wait for human confirmation before fixing anything.
