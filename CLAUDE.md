# Extension Desk

Renter texts an extension request; the LLM parses it; code decides; the operator approves.
Full spec: `docs/SPEC.md` (source of truth, never edit). Build only the phase you are asked for.

## Non-negotiable rules
- The LLM only parses the renter's message. Prices, times shown to users, availability and options come from code.
- The operator approves every change. Nothing is charged without a click.
- Turo bookings are immovable. Never reassign them.
- Approve runs in a DB transaction and re-checks availability first; on change return 409 and re-evaluate.
- Partial extensions are offered, then charged only after the renter accepts.
- No automatic replies to renters. Only the spec's section 9 templates, sent on operator action.
- Money is integer cents. Store UTC, display in OPERATOR_TIMEZONE (Luxon).
- Engine and pricing are pure functions in `server/src/extensions/engine`: no Nest/Prisma imports.
- SQLite: enum-like fields are Strings validated in TS; JSON stored as text.
- Every state change writes an Event.
- Everything works with `LLM_PROVIDER=none` (manual mode). Groq is runtime only.
- Cut decision (user, 3 Oct): no `AnthropicProvider`. Providers are Groq + Null only; keep the `LlmProvider` interface and list the cut in the README "left out" table.
- Scope cuts follow spec section 17 in order; never cut the "never cut" list.
- Scope addition (user, 3 Oct): a Playground page (Phase 5b), built after Phase 5, only if time allows; it is the first thing cut. It uses the same pipeline as the demo and adds no second code path.

## Commands
- `npm run setup`: install, migrate, seed
- `npm run dev`: server :3000, web :5173
- `npm test`: server tests (run before saying a phase is done)
- `npm run reset`: re-seed

## Skills (`.claude/skills/`)
- `engine-rules`, `llm-parser-rules`, `ui-rules`: load automatically when editing matching paths
- `/phase-check <n>`: verify a phase against spec section 14 and the rules above
- `/fresh-clone-check`: clone to a temp dir and run the README setup end to end
