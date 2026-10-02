import { Controller, Get } from '@nestjs/common';
import { settings } from '../config/settings';

@Controller('api/meta')
export class MetaController {
  @Get()
  get() {
    const mode = process.env.LLM_PROVIDER ?? 'groq';
    const parserLabel = mode === 'none' ? 'Manual mode' : 'Parser: Groq';
    return {
      operatorName: settings.operatorName,
      timezone: settings.timezone,
      now: new Date().toISOString(),
      parserLabel,
      parserActive: mode !== 'none',
    };
  }
}
