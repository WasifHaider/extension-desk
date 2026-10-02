import { DateTime } from 'luxon';
import { EngineBooking } from '../extensions/engine/types';

function formatWhen(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone).toFormat('ccc d MMM, h:mm a');
}

export function conflictFoundDetail(conflict: EngineBooking, timezone: string): string {
  const when = formatWhen(conflict.startAt, timezone);
  if (conflict.source === 'TURO') {
    return `Conflict found: Turo booking ${when}`;
  }
  const who = conflict.renterName ?? 'Direct renter';
  return `Conflict found: direct booking ${who}, ${when}`;
}

export function alternateCarFoundDetail(vehicleName: string): string {
  return `Alternate car found: ${vehicleName}`;
}
