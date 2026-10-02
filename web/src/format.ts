import { DateTime } from 'luxon';

const TZ_ABBREV: Record<string, string> = {
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Los_Angeles': 'PT',
};

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function formatDateTime(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone).toFormat('ccc d MMM, h:mm a');
}

export function formatDayLabel(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone).toFormat('ccc d');
}

export function formatClockTime(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone).toFormat('h:mm a');
}

export function formatHeaderClock(iso: string, timezone: string): string {
  const abbrev = TZ_ABBREV[timezone] ?? '';
  const base = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone).toFormat('ccc d MMM, h:mm a');
  return abbrev ? `${base} ${abbrev}` : base;
}

export function formatInboxTime(iso: string, timezone: string, nowIso: string): string {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone);
  const now = DateTime.fromISO(nowIso, { zone: 'utc' }).setZone(timezone);
  return dt.hasSame(now, 'day') ? dt.toFormat('h:mm a') : dt.toFormat('ccc');
}

export function pluralDays(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}
