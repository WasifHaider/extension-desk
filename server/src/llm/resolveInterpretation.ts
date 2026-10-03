import { DateTime } from 'luxon';
import { rawParseSchema } from './schema';

export interface InterpretationContext {
  currentEndAt: Date;
  timezone: string;
  maxExtensionDays: number;
  vagueTimeDefaults: Record<string, string>;
}

export type InterpretationResult =
  | { status: 'NEEDS_DATE'; interpretationNote: string }
  | { status: 'NOT_EXTENSION' }
  | { status: 'RESOLVED'; interpretedEndAt: Date; interpretationNote: string };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function formatReadAs(dt: DateTime): string {
  return dt.toFormat('ccc d MMM, h:mm a');
}

function formatTime(hhmm: string, timezone: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return DateTime.fromObject({ hour: h, minute: m }, { zone: timezone }).toFormat('h:mm a');
}

export function resolveInterpretation(
  rawInput: unknown,
  context: InterpretationContext,
): InterpretationResult {
  const parsed = rawParseSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: 'NEEDS_DATE', interpretationNote: 'Could not understand the message' };
  }
  const raw = parsed.data;

  if (raw.intent !== 'EXTEND') {
    return { status: 'NOT_EXTENSION' };
  }

  if (!raw.date) {
    return { status: 'NEEDS_DATE', interpretationNote: 'No date given' };
  }

  const dateInTz = DateTime.fromISO(raw.date, { zone: context.timezone });
  if (!dateInTz.isValid) {
    return { status: 'NEEDS_DATE', interpretationNote: 'Could not understand the date' };
  }

  if (raw.weekday) {
    const actualWeekday = dateInTz.toFormat('cccc');
    if (actualWeekday.toLowerCase() !== raw.weekday.toLowerCase()) {
      return { status: 'NEEDS_DATE', interpretationNote: "Weekday doesn't match the date" };
    }
  }

  let time: string;
  let sourceNote: string;
  if (raw.time && TIME_RE.test(raw.time)) {
    time = raw.time;
    sourceNote = '';
  } else if (raw.time_phrase && context.vagueTimeDefaults[raw.time_phrase]) {
    time = context.vagueTimeDefaults[raw.time_phrase];
    sourceNote = ` ("${raw.time_phrase}" → ${formatTime(time, context.timezone)} default)`;
  } else {
    const currentLocal = DateTime.fromJSDate(context.currentEndAt, { zone: 'utc' }).setZone(
      context.timezone,
    );
    time = currentLocal.toFormat('HH:mm');
    sourceNote = ' (kept current return time)';
  }

  const [hour, minute] = time.split(':').map(Number);
  const interpretedLocal = dateInTz.set({ hour, minute, second: 0, millisecond: 0 });
  const interpretedEndAt = interpretedLocal.toUTC().toJSDate();

  if (interpretedEndAt.getTime() <= context.currentEndAt.getTime()) {
    return {
      status: 'NEEDS_DATE',
      interpretationNote: 'Requested end is before the current end',
    };
  }

  const maxEndAt = DateTime.fromJSDate(context.currentEndAt, { zone: 'utc' }).plus({
    days: context.maxExtensionDays,
  });
  if (interpretedEndAt.getTime() > maxEndAt.toJSDate().getTime()) {
    return {
      status: 'NEEDS_DATE',
      interpretationNote: `Beyond the ${context.maxExtensionDays}-day max`,
    };
  }

  return {
    status: 'RESOLVED',
    interpretedEndAt,
    interpretationNote: `Read as ${formatReadAs(interpretedLocal)}${sourceNote}`,
  };
}
