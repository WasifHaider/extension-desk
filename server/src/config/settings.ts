export const settings = {
  operatorName: 'Hudson Drive Rentals',
  timezone: process.env.OPERATOR_TIMEZONE ?? 'America/New_York',
  turnaroundBufferMinutes: 120,
  maxExtensionDays: 14,
  longTripTiers: [
    { minDays: 7, pct: 10 },
    { minDays: 28, pct: 20 },
  ],
  vagueTimeDefaults: {
    morning: '10:00',
    afternoon: '14:00',
    evening: '18:00',
    night: '21:00',
  },
} as const;
