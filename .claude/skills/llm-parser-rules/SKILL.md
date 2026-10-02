---
name: llm-parser-rules
description: Rules for the LLM message parser, providers and guardrails. Use when editing anything in server/src/llm or the resolveInterpretation logic.
paths: server/src/llm/**
---

Spec: section 6, principles 1, 5 and 8 in section 3, parsing tests in section 13.

## Rules
- The LLM only parses the renter's message into the section 6 JSON. It never produces prices, times shown to users, availability or options.
- Provider interface: `LlmProvider.parseExtensionRequest(input): Promise<RawParse>`.
  - `GroqProvider` (default, JSON mode), `AnthropicProvider` (first on the cut line), `NullProvider` (always throws).
  - `LLM_PROVIDER` selects: `groq | anthropic | none`.
- One shared file holds the system prompt and JSON schema. Every provider imports it; no per-provider prompt copies.
- `GROQ_MODEL` comes from env. Never hardcode or guess a model name; fail clearly if it is unset.
- Validate model output with zod. Invalid JSON, schema mismatch or API error means `NEEDS_DATE`.
- `resolveInterpretation` is a pure function:
  - weekday cross-check: a `weekday` that does not match `date` is rejected, giving `NEEDS_DATE`;
  - time: explicit `time`, else `time_phrase` via `vagueTimeDefaults`, else keep the current end's time of day;
  - result must be after current `endAt` and at most `maxExtensionDays` beyond it, else `NEEDS_DATE` with a note;
  - write `interpretationNote`; non-`EXTEND` intent gives `NOT_EXTENSION`.
- If the provider throws (including `NullProvider`), fall back to `NEEDS_DATE`. Never let a parser error break inbound handling.
- Seed data never calls the LLM.

## Tests (section 13)
Weekday mismatch; "night" is 21:00; no time keeps current end time; end before current end; beyond max; provider throws.
