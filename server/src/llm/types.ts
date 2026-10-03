export interface ParseInput {
  message: string;
  vehicleName: string;
  currentEndAtLocalIso: string;
  currentEndAtWeekday: string;
  nowLocalIso: string;
  nowWeekday: string;
  timezone: string;
}

export type Intent = 'EXTEND' | 'EARLY_RETURN' | 'OTHER';
export type TimePhrase = 'morning' | 'afternoon' | 'evening' | 'night' | null;

export interface RawParse {
  intent: Intent;
  date: string | null;
  weekday: string | null;
  time: string | null;
  time_phrase: TimePhrase;
  clarifying_question: string | null;
}

export interface LlmProvider {
  parseExtensionRequest(input: ParseInput): Promise<RawParse>;
}
