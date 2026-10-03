import { LlmProvider } from '../types';
import { GroqProvider } from './groq.provider';
import { NullProvider } from './null.provider';

export { GroqProvider } from './groq.provider';
export { NullProvider } from './null.provider';

export function createLlmProvider(): LlmProvider {
  const mode = process.env.LLM_PROVIDER ?? 'groq';
  if (mode === 'none') {
    return new NullProvider();
  }
  return new GroqProvider();
}
