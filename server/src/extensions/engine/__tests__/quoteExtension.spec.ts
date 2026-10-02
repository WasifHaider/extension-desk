import { quoteExtension } from '../quoteExtension';
import { EngineBooking, EngineSettings } from '../types';

const settings: EngineSettings = {
  turnaroundBufferMinutes: 120,
  longTripTiers: [
    { minDays: 7, pct: 10 },
    { minDays: 28, pct: 20 },
  ],
};

function makeBooking(overrides: Partial<EngineBooking> = {}): EngineBooking {
  return {
    id: 'b1',
    vehicleId: 'v1',
    source: 'DIRECT',
    status: 'ACTIVE',
    startAt: new Date('2026-10-01T10:00:00Z'),
    endAt: new Date('2026-10-02T10:00:00Z'),
    dailyRateCents: 11000,
    coverageDailyCents: 0,
    ...overrides,
  };
}

describe('quoteExtension', () => {
  it('59 hours is 3 billable days', () => {
    const booking = makeBooking();
    const newEndAt = new Date(booking.endAt.getTime() + 59 * 60 * 60 * 1000);
    const quote = quoteExtension(booking, newEndAt, settings);
    expect(quote.billableDays).toBe(3);
  });

  it('crossing the 7-day tier discounts the extension days only', () => {
    const booking = makeBooking({
      startAt: new Date('2026-10-01T10:00:00Z'),
      endAt: new Date('2026-10-05T10:00:00Z'),
    });
    // total trip so far is 4 days; extend by 3 more days -> totalTripDays = 7, tier applies.
    const newEndAt = new Date('2026-10-08T10:00:00Z');
    const quote = quoteExtension(booking, newEndAt, settings);

    expect(quote.totalTripDays).toBe(7);
    expect(quote.billableDays).toBe(3);
    expect(quote.pct).toBe(10);

    const baseLine = quote.lineItems.find((l) => l.label.includes('days ×'));
    const discountLine = quote.lineItems.find((l) => l.label.startsWith('Long-trip discount'));
    expect(baseLine?.amountCents).toBe(3 * 11000);
    expect(discountLine?.amountCents).toBe(-Math.round(3 * 11000 * 0.1));
    expect(quote.totalCents).toBe(3 * 11000 - Math.round(3 * 11000 * 0.1));
  });

  it('includes a coverage line only when the booking has coverage', () => {
    const withCover = makeBooking({ coverageDailyCents: 1500 });
    const withoutCover = makeBooking({ coverageDailyCents: 0 });
    const newEndAt = new Date(withCover.endAt.getTime() + 2 * 24 * 60 * 60 * 1000);

    const coveredQuote = quoteExtension(withCover, newEndAt, settings);
    const uncoveredQuote = quoteExtension(withoutCover, newEndAt, settings);

    expect(coveredQuote.lineItems.some((l) => l.label.startsWith('Damage cover'))).toBe(true);
    expect(uncoveredQuote.lineItems.some((l) => l.label.startsWith('Damage cover'))).toBe(false);
    expect(coveredQuote.totalCents).toBe(uncoveredQuote.totalCents + 2 * 1500);
  });
});
