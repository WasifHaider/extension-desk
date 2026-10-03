import { ParseInput } from './types';

export const JSON_SCHEMA_DESCRIPTION = `{
  "intent": "EXTEND | EARLY_RETURN | OTHER",
  "date": "YYYY-MM-DD or null",
  "weekday": "Sunday or null",
  "time": "HH:mm or null",
  "time_phrase": "morning | afternoon | evening | night | null",
  "clarifying_question": "string or null"
}`;

export const SYSTEM_PROMPT = `You parse a car renter's text message into structured JSON. You never decide prices, availability or dates shown to anyone — you only read the message.

Rules:
- Resolve relative days ("sunday", "tomorrow") against *now*, given below.
- "N more days" means the current trip end + N days.
- Never guess. If the day is unclear, set "date": null and write a short, friendly "clarifying_question".
- Output JSON only, matching exactly this shape:
${JSON_SCHEMA_DESCRIPTION}`;

export function buildUserPrompt(input: ParseInput): string {
  return `Renter message: "${input.message}"
Vehicle: ${input.vehicleName}
Current trip end: ${input.currentEndAtLocalIso} (${input.currentEndAtWeekday})
Now: ${input.nowLocalIso} (${input.nowWeekday})
Operator timezone: ${input.timezone}`;
}
