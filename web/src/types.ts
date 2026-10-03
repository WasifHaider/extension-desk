export interface Vehicle {
  id: string;
  name: string;
  category: string;
  seats: number;
  dailyRateCents: number;
  plate: string;
}

export interface RenterPickerEntry {
  id: string;
  name: string;
  vehicleName: string | null;
  bookingId: string | null;
}

export interface Message {
  id: string;
  renterId: string;
  bookingId: string | null;
  direction: 'IN' | 'OUT';
  body: string;
  status: string;
  createdAt: string;
}

export type Badge = 'CLEAN' | 'CONFLICT' | 'NEEDS_DATE' | 'OFFERED' | 'APPROVED' | 'DECLINED' | 'NOT_EXTENSION';

export interface InboxRow {
  id: string;
  createdAt: string;
  renterName: string;
  vehicleName: string;
  preview: string;
  status: string;
  badge: Badge;
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
  newEndAt: string;
  quote: Quote | null;
  reassign?: ReassignDetail;
}

export interface UnavailableOption {
  type: OptionType;
  reason: string;
}

export interface EngineBookingRef {
  id: string;
  vehicleId: string;
  source: 'DIRECT' | 'TURO';
  status: string;
  startAt: string;
  endAt: string;
  dailyRateCents: number;
  coverageDailyCents: number;
  renterName: string | null;
}

export interface NextBooking {
  id: string;
  source: 'DIRECT' | 'TURO';
  startAt: string;
  endAt: string;
  renterName: string | null;
}

export interface ReassignInfo {
  bookingId: string;
  toVehicleName: string;
  toVehicleCategory: string;
  nextRenterName: string;
}

export interface EventRow {
  id: string;
  type: string;
  detail: string | null;
  createdAt: string;
}

export interface ExtensionRequestDetail {
  id: string;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  rawText: string;
  message: { body: string; createdAt: string };
  renter: { id: string; name: string } | null;
  vehicle: { id: string; name: string; category: string };
  hasCover: boolean;
  originalEndAt: string;
  currentEndAt: string;
  interpretedEndAt: string | null;
  interpretationNote: string | null;
  clarifyingQuestionDraft: string | null;
  options: EngineOption[];
  unavailable: UnavailableOption[];
  conflicts: EngineBookingRef[];
  latestFreeEnd: string | null;
  freeUntil: string | null;
  nextBooking: NextBooking | null;
  reassign: ReassignInfo | null;
  chosenOptionType: OptionType | null;
  chosenEndAt: string | null;
  declineReason: string | null;
  charge: { amountCents: number } | null;
  receipt: QuoteLineItem[] | null;
  events: EventRow[];
}

export interface PlaygroundBooking {
  id: string;
  vehicleId: string;
  renterId: string | null;
  source: 'DIRECT' | 'TURO';
  status: string;
  startAt: string;
  endAt: string;
  dailyRateCents: number;
  coverageDailyCents: number;
  coverageEndsAt: string | null;
  vehicle: Vehicle;
  renter: { id: string; name: string } | null;
}

export interface Meta {
  operatorName: string;
  timezone: string;
  now: string;
  parserLabel: string;
  parserActive: boolean;
}
