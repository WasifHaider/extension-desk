import { LlmProvider, ParseInput, RawParse } from './types';
import { InterpretationContext, InterpretationResult, resolveInterpretation } from './resolveInterpretation';

export interface InterpretOutcome {
  result: InterpretationResult;
  rawParse: RawParse | null;
}

export async function interpretRequest(
  provider: LlmProvider,
  input: ParseInput,
  context: InterpretationContext,
): Promise<InterpretOutcome> {
  let rawParse: RawParse | null = null;
  try {
    rawParse = await provider.parseExtensionRequest(input);
  } catch (err) {
    console.error('[llm] parseExtensionRequest failed:', err);
    return {
      rawParse: null,
      result: { status: 'NEEDS_DATE', interpretationNote: 'Could not reach the parser' },
    };
  }
  return { rawParse, result: resolveInterpretation(rawParse, context) };
}
