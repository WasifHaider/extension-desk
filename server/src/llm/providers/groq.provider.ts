import Groq from 'groq-sdk';
import { LlmProvider, ParseInput, RawParse } from '../types';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt';
import { rawParseSchema } from '../schema';

export class GroqProvider implements LlmProvider {
  private client: Groq;
  private model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set');
    }
    if (!model) {
      throw new Error('GROQ_MODEL is not set');
    }
    this.client = new Groq({ apiKey });
    this.model = model;
  }

  async parseExtensionRequest(input: ParseInput): Promise<RawParse> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Groq returned no content');
    }

    const json = JSON.parse(content);
    return rawParseSchema.parse(json);
  }
}
