# Claude Code setup

What is in `.claude/` and why. Nothing here is generic; each piece prevents a specific mistake.

## Three layers

| Layer | Where | Role |
|---|---|---|
| Facts and rules | `CLAUDE.md` | Short list of non-negotiable rules and commands, always in context |
| Procedures | `.claude/skills/` | Domain knowledge loaded on demand, not paid for every turn |
| Enforcement | `.claude/settings.json` + `.claude/hooks/` | Deterministic checks that do not rely on the model remembering |

## Skills

- `engine-rules`, `llm-parser-rules`, `ui-rules`: reference skills scoped with `paths:`, so they load only when Claude touches that part of the code. They link to spec sections instead of copying them.
- `/phase-check <n>`: runs the spec's "Done when" for a phase, runs tests, and greps for the rules that must never break (LLM output used for prices, Turo reassignment, approve without transaction, automatic renter replies). Prints a PASS/FAIL table.
- `/fresh-clone-check`: clones the repo to a temp dir, follows the README exactly, and checks the 5-request seed works with no API key.

Both task skills have `disable-model-invocation: true`; they run only when invoked by hand.

## Hooks (Node scripts, no jq or bash dependency)

- `guard.mjs` (PreToolUse): blocks edits to `docs/SPEC.md`, `.env` (not `.env.example`) and `.git/`.
- `engine-tests.mjs` (PostToolUse): after an edit under the engine folder, runs `npm test --workspace server -- engine` and feeds failures back to Claude. It does nothing until a test script exists.
- `compact-reminder.mjs` (SessionStart, `compact`): re-injects five rules after context compaction.

## Permissions

Allowed without prompting: `npm run`, `npm test`, `npx prisma`, and read/stage/commit git commands. No broad Bash allow. `Read(./.env)` is denied.

## Workflow

1. Spec first: `docs/SPEC.md` is the contract.
2. One Claude Code session per phase (spec section 14).
3. `/clear` between phases.
4. `/phase-check <n>` before moving on.
5. Commit, then the next phase.

### Phase 5b: Playground

Optional, after Phase 5, first thing cut if time runs short. A `/playground` page exercising the same real pipeline (inbound message, parse, evaluate, approve/offer/decline) against isolated seed data, for manual testing of every extension case. No second code path; reuses Phase 1-5 components and endpoints.
