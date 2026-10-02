---
name: engine-rules
description: Rules for the availability, conflict and pricing engine. Use when editing or testing anything in server/src/extensions/engine.
paths: server/src/extensions/engine/**
---

Spec: sections 7 (engine), 8 (pricing), 13 (tests). Read them before changing logic.

## Constraints
- Pure functions. No Nest or Prisma imports; take plain data in, return plain data.
- Money is integer cents; round each line half-up.
- Luxon, times in UTC internally. Billing uses minutes (24h periods), never calendar days, so DST cannot change a price.

## Engine (section 7)
- Blocking = `CONFIRMED` or `ACTIVE`, any source, excluding the booking itself. `CANCELLED` and `COMPLETED` never block.
- `conflicts` overlap `[booking.endAt, requestedEndAt + buffer)`.
- `latestFreeEnd = min(conflicts.startAt) - buffer`, else `requestedEndAt`.
- `nextBooking` = first blocking booking on the same vehicle starting at or after `booking.endAt`. `freeUntil = nextBooking.startAt - buffer` or `null`.
- Preconditions:
  - `FULL`: no conflicts.
  - `PARTIAL`: conflicts and `latestFreeEnd >= endAt + 1h`; `newEndAt` rounded down to 30 min.
  - `REASSIGN_NEXT`: exactly one conflict, it is `DIRECT` + `CONFIRMED`, and a comparable vehicle is free for its whole window (same category, seats >=, closest rate; ties lower rate then name). **A Turo booking is never moved.**
  - `DECLINE`: always.
- Every impossible option gets a human-readable reason in `unavailable` (exact examples in section 7).

## Pricing (section 8)
- `billableDays = ceil(extraMinutes / 1440)`.
- Long-trip tier discounts the extension days only, chosen by `totalTripDays`.
- Coverage line only when `coverageDailyCents > 0`.
- Return line items for the UI.

## Tests (section 13, must exist and pass)
- Engine: FULL clear; FULL at the exact buffer boundary; PARTIAL + Turo reason; REASSIGN with free comparable car; REASSIGN unavailable when the car is busy; CANCELLED does not block; two conflicts means no REASSIGN.
- Pricing: 59 h is 3 days; 7-day tier on extension days only; coverage only when present.
