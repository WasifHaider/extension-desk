---
name: phase-check
description: Verify a finished build phase against the spec and the project's hard rules. Use when asked to check, review or sign off phase N, e.g. /phase-check 2.
disable-model-invocation: true
argument-hint: "[phase-number]"
---

Check phase $ARGUMENTS. Report only; fix nothing unless asked. Prefer grep and targeted reads over reading whole files.

1. Read the "Done when" line for phase $ARGUMENTS in `docs/SPEC.md` section 14 (read only that phase block). For 5b, use the Playground requirements in CLAUDE.md and the 5b prompt in the repo notes: Done when the checklist in step 2 below passes.
2. Verify it. Run the commands it names (e.g. `npm run setup`, `npm run dev` briefly). Run `npm test` if the repo has tests.
3. Grep `server/` and `web/` for violations of the non-negotiable and never-cut rules:
   - LLM output used for prices, shown times or options (anything in `server/src/llm` feeding pricing or message templates).
   - Turo bookings reassigned or moved (`REASSIGN_NEXT` that does not require `source === 'DIRECT'`, any update of a Turo booking's `vehicleId`).
   - Approve without `$transaction` or without re-running `evaluateExtension`.
   - Automatic renter replies (outbound `Message` created in the inbound handler or on request creation).
   - Money as floats; Nest/Prisma imports under `server/src/extensions/engine`.
   Skip a check that does not apply yet (code not written in this phase).
4. Output a short table: `Check | PASS/FAIL/N-A | evidence (file:line or command output line)`. Finish with one line: overall PASS or FAIL.
