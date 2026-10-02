// SessionStart (compact): stdout is added to Claude's context, so the rules survive compaction.
console.log(`Extension Desk reminder (docs/SPEC.md is the source of truth):
1. The LLM only parses the message; prices, times and options come from code. Money is integer cents.
2. The operator approves every change; approve = transaction + re-check, else 409. Partial = offer, then charge on accept.
3. Turo bookings are never moved. No automatic replies to renters.
4. Engine is pure (no Nest/Prisma). Every state change writes an Event. Works with LLM_PROVIDER=none.
5. Build only the current phase; run npm test before calling it done.`);
