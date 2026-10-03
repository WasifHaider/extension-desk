import { z } from 'zod';

export const rawParseSchema = z.object({
  intent: z.enum(['EXTEND', 'EARLY_RETURN', 'OTHER']),
  date: z.string().nullable(),
  weekday: z.string().nullable(),
  time: z.string().nullable(),
  time_phrase: z.enum(['morning', 'afternoon', 'evening', 'night']).nullable(),
  clarifying_question: z.string().nullable(),
});
