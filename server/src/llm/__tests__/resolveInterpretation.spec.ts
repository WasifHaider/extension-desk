import { DateTime } from 'luxon';
import { resolveInterpretation, InterpretationContext } from '../resolveInterpretation';
import { interpretRequest } from '../interpretRequest';
import { LlmProvider, ParseInput, RawParse } from '../types';

const TZ = 'America/New_York';

function baseContext(currentEndAt: Date): InterpretationContext {
  return {
    currentEndAt,
    timezone: TZ,
    maxExtensionDays: 14,
    vagueTimeDefaults: {
      morning: '10:00',
      afternoon: '14:00',
      evening: '18:00',
      night: '21:00',
    },
  };
}

function raw(overrides: Partial<RawParse>): RawParse {
  return {
    intent: 'EXTEND',
    date: null,
    weekday: null,
    time: null,
    time_phrase: null,
    clarifying_question: null,
    ...overrides,
  };
}

describe('resolveInterpretation', () => {
  // Friday 2026-10-02 10:00 ET
  const currentEndAt = DateTime.fromObject(
    { year: 2026, month: 10, day: 2, hour: 10, minute: 0 },
    { zone: TZ },
  )
    .toUTC()
    .toJSDate();

  it('weekday mismatch rejects to NEEDS_DATE', () => {
    // 2026-10-04 is a Sunday, but we claim Saturday.
    const result = resolveInterpretation(
      raw({ date: '2026-10-04', weekday: 'Saturday', time: '21:00' }),
      baseContext(currentEndAt),
    );
    expect(result.status).toBe('NEEDS_DATE');
  });

  it('"night" resolves to 21:00', () => {
    const result = resolveInterpretation(
      raw({ date: '2026-10-04', weekday: 'Sunday', time_phrase: 'night' }),
      baseContext(currentEndAt),
    );
    expect(result.status).toBe('RESOLVED');
    if (result.status === 'RESOLVED') {
      const local = DateTime.fromJSDate(result.interpretedEndAt, { zone: 'utc' }).setZone(TZ);
      expect(local.toFormat('HH:mm')).toBe('21:00');
    }
  });

  it('no time given keeps the current end time', () => {
    const result = resolveInterpretation(
      raw({ date: '2026-10-04', weekday: 'Sunday' }),
      baseContext(currentEndAt),
    );
    expect(result.status).toBe('RESOLVED');
    if (result.status === 'RESOLVED') {
      const local = DateTime.fromJSDate(result.interpretedEndAt, { zone: 'utc' }).setZone(TZ);
      expect(local.toFormat('HH:mm')).toBe('10:00');
    }
  });

  it('requested end before the current end rejects to NEEDS_DATE', () => {
    const result = resolveInterpretation(
      raw({ date: '2026-10-01', weekday: 'Thursday', time: '09:00' }),
      baseContext(currentEndAt),
    );
    expect(result.status).toBe('NEEDS_DATE');
  });

  it('beyond the max rejects to NEEDS_DATE', () => {
    const result = resolveInterpretation(
      raw({ date: '2026-10-20', weekday: 'Tuesday', time: '10:00' }),
      baseContext(currentEndAt),
    );
    expect(result.status).toBe('NEEDS_DATE');
  });

  it('non-EXTEND intent returns NOT_EXTENSION', () => {
    const result = resolveInterpretation(
      raw({ intent: 'OTHER', date: null }),
      baseContext(currentEndAt),
    );
    expect(result.status).toBe('NOT_EXTENSION');
  });

  it('provider throws resolves to NEEDS_DATE', async () => {
    const throwingProvider: LlmProvider = {
      parseExtensionRequest: async (_input: ParseInput) => {
        throw new Error('network down');
      },
    };
    const input: ParseInput = {
      message: 'keep it longer',
      vehicleName: 'Tesla Model 3',
      currentEndAtLocalIso: '2026-10-02T10:00:00',
      currentEndAtWeekday: 'Friday',
      nowLocalIso: '2026-10-01T09:00:00',
      nowWeekday: 'Thursday',
      timezone: TZ,
    };
    const outcome = await interpretRequest(throwingProvider, input, baseContext(currentEndAt));
    expect(outcome.result.status).toBe('NEEDS_DATE');
    expect(outcome.rawParse).toBeNull();
  });
});
