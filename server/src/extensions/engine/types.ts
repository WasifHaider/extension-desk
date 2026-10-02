export type BookingStatus = 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type BookingSource = 'DIRECT' | 'TURO';

export interface EngineBooking {
  id: string;
  vehicleId: string;
  source: BookingSource;
  status: BookingStatus;
  startAt: Date;
  endAt: Date;
  dailyRateCents: number;
  coverageDailyCents: number;
  renterName?: string | null;
}

export interface EngineVehicle {
  id: string;
  name: string;
  category: string;
  seats: number;
  dailyRateCents: number;
}

export interface LongTripTier {
  minDays: number;
  pct: number;
}

export interface EngineSettings {
  turnaroundBufferMinutes: number;
  longTripTiers: LongTripTier[];
  timezone?: string;
}

export type OptionType = 'FULL' | 'PARTIAL' | 'REASSIGN_NEXT' | 'DECLINE';

export interface QuoteLineItem {
  label: string;
  amountCents: number;
}

export interface Quote {
  billableDays: number;
  totalTripDays: number;
  pct: number;
  lineItems: QuoteLineItem[];
  totalCents: number;
}

export interface ReassignDetail {
  bookingId: string;
  fromVehicleId: string;
  toVehicleId: string;
}

export interface EngineOption {
  type: OptionType;
  newEndAt: Date;
  quote: Quote | null;
  reassign?: ReassignDetail;
}

export interface UnavailableOption {
  type: OptionType;
  reason: string;
}

export interface Evaluation {
  options: EngineOption[];
  unavailable: UnavailableOption[];
  conflicts: EngineBooking[];
  latestFreeEnd: Date | null;
  nextBooking: EngineBooking | null;
  freeUntil: Date | null;
}
