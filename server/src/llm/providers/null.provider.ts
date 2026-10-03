import { LlmProvider, ParseInput, RawParse } from '../types';

export class NullProvider implements LlmProvider {
  async parseExtensionRequest(_input: ParseInput): Promise<RawParse> {
    throw new Error('LLM_PROVIDER is none — no parser configured');
  }
}
