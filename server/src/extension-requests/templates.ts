import { DateTime } from 'luxon';
import { formatMoney } from '../extensions/engine/quoteExtension';

function formatTemplateTime(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone).toFormat('ccc d MMM, h:mm a');
}

export function fullConfirmationTemplate(
  vehicleName: string,
  newEndAt: Date,
  totalCents: number,
  timezone: string,
): string {
  return `You're all set — your ${vehicleName} is now due back ${formatTemplateTime(
    newEndAt,
    timezone,
  )}. ${formatMoney(totalCents)} has been charged to your card on file.`;
}

export function reassignNextRenterTemplate(
  nextStartAt: Date,
  newVehicleName: string,
  oldVehicleName: string,
  timezone: string,
): string {
  return `Quick update for your trip starting ${formatTemplateTime(
    nextStartAt,
    timezone,
  )}: you'll be in a ${newVehicleName} (same class) instead of the ${oldVehicleName}, same price. Reply if that doesn't work for you.`;
}

export function partialOfferTemplate(
  vehicleName: string,
  newEndAt: Date,
  totalCents: number,
  timezone: string,
): string {
  return `Your ${vehicleName} has another booking right after you, so the latest return we can offer is ${formatTemplateTime(
    newEndAt,
    timezone,
  )}. Extending to then is ${formatMoney(totalCents)}. Reply YES to confirm.`;
}

export function declineTemplate(reason: string, currentEndAt: Date, timezone: string): string {
  return `Sorry, we can't extend this time — ${reason}. Your return time stays ${formatTemplateTime(
    currentEndAt,
    timezone,
  )}.`;
}

export function clarifyFallbackTemplate(vehicleName: string): string {
  return `Happy to help! What day and time would you like to return the ${vehicleName}?`;
}
