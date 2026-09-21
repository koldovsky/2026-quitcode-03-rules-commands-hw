# QuitCode Workshop 3 — Homework (rules & commands)

Starter repo for the third homework of the QuitCode **"Modern Development with
Agentic AI"** course.

> Workshop 3: **Правила та команди: керована поведінка AI**
> Автор: В'ячеслав Колдовський — Dev AI Consulting (dev-ai.dev)

---

> 🧭 **Рев'ювер цієї домашки — почніть звідси: [`docs/reviewer-map.md`](docs/reviewer-map.md).**
> Одна команда (`bash tools/verify-all.sh`) перевіряє всі числа, далі — чотири
> файли, що показують суть, і таблиця «пункт рубрики → де доказ».
> Здав: **Hryhorii Haponiuk**.

---

WS2 ended with "permissions beat rules". WS3 makes rules actually work: project
rules in the Claude Code and Cursor formats, `AGENTS.md` as a cross-tool baseline,
commands as an API to the agent — and an A/B run that shows, with numbers, whether
the rules change what the agent does. ~1.5–2 hours.

## Quick start

```bash
gh repo fork koldovsky/2026-quitcode-03-rules-commands-hw --clone
cd 2026-quitcode-03-rules-commands-hw
git checkout -b ws03/<github-username>
cd app && npm install && npm test && npm run check:rules && cd ..
# follow docs/walkthrough.md
gh pr create --web   # fill in the PR template, incl. «Ім'я та Прізвище»
```

Full step-by-step instructions: [`docs/walkthrough.md`](docs/walkthrough.md).

## What's in here

| Path | Purpose |
|---|---|
| `app/` | `lead-sync` — a lead-routing worker migrated from n8n (Slack + Google Sheets). TypeScript, Vitest, zero runtime deps |
| `app/src/core/` | Platform core — **protected** zone |
| `app/scripts/check-rules.mjs` | Static checker for the project rules: `npm run check:rules` (baseline: 8 violations in legacy code) |
| `materials/architecture-brief.md` | Architecture note — the source of truth your rules are written from |
| `materials/error-log.txt` | Production log excerpt of a night incident — target for `/analyze-error` |
| `materials/ab-task.md` | The prompt for the rules-on / rules-off A/B run |
| `docs/templates/` | Templates: Claude Code rule, Cursor rule, command, evidence reports |
| `.coderabbit.yaml` | CodeRabbit review tuned to this homework's DoD |

### About `AGENTS.md` and `CLAUDE.md` in this repo

Both are **deliberately weak** in the starter. The generic "write clean code"
baseline and the markdown *link* to `AGENTS.md` in `CLAUDE.md` (a link is not an
import — Claude Code does not load the linked file) are the starting point of
Task B, not guidance to follow.

### About the data in `materials/` and tests

Everything is **synthetic**: the client, leads, contacts and tokens are invented,
domains use the reserved `.example.test` suffix, and keys carry a `fake` prefix.

## Tools

Claude Code or Cursor (at least one) + a GitHub account + Node 22+.
Questions → the course chat.
