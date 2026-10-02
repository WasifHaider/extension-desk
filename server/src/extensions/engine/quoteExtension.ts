import { EngineBooking, EngineSettings, Quote, QuoteLineItem } from './types';

const MINUTES_PER_DAY = 1440;

function daysBetween(fromMs: number, toMs: number): number {
  return Math.ceil((toMs - fromMs) / (MINUTES_PER_DAY * 60 * 1000));
}

function roundHalfUp(amount: number): number {
  return Math.round(amount);
}

function tierForTotalDays(settings: EngineSettings, totalTripDays: number): number {
  let pct = 0;
  for (const tier of settings.longTripTiers) {
    if (tier.minDays <= totalTripDays && tier.pct > pct) {
      pct = tier.pct;
    }
  }
  return pct;
}

function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

export function quoteExtension(
  booking: EngineBooking,
  newEndAt: Date,
  settings: EngineSettings,
): Quote {
  const billableDays = daysBetween(booking.endAt.getTime(), newEndAt.getTime());
  const totalTripDays = daysBetween(booking.startAt.getTime(), newEndAt.getTime());
  const pct = tierForTotalDays(settings, totalTripDays);

  const lineItems: QuoteLineItem[] = [];

  const baseRentalCents = roundHalfUp(billableDays * booking.dailyRateCents);
  const dayLabel = billableDays === 1 ? '1 day' : `${billableDays} days`;
  lineItems.push({
    label: `${dayLabel} × ${formatMoney(booking.dailyRateCents)}`,
    amountCents: baseRentalCents,
  });

  let rentalCents = baseRentalCents;
  if (pct > 0) {
    const discountCents = roundHalfUp(baseRentalCents * (pct / 100));
    rentalCents = baseRentalCents - discountCents;
    lineItems.push({
      label: `Long-trip discount −${pct}%`,
      amountCents: -discountCents,
    });
  }

  let coverageCents = 0;
  if (booking.coverageDailyCents > 0) {
    coverageCents = roundHalfUp(billableDays * booking.coverageDailyCents);
    lineItems.push({
      label: `Damage cover ${billableDays} × ${formatMoney(booking.coverageDailyCents)}`,
      amountCents: coverageCents,
    });
  }

  const totalCents = rentalCents + coverageCents;
  lineItems.push({ label: 'Total', amountCents: totalCents });

  return { billableDays, totalTripDays, pct, lineItems, totalCents };
}
