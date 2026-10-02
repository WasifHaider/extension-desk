---
name: ui-rules
description: Locked UI rules for the Vue front end: badges, timeline, option cards, event log copy. Use when editing anything in web/src.
paths: web/src/**
---

Spec: section 11a wins over section 11. Read the relevant 11a subsection before building a component.

## Essentials
- Amber means conflict only (the `Conflict` badge and the conflict zone). Never use it for neutral labels.
- No automatic renter replies. The phone thread shows only messages produced by operator actions (principle 9).
- Badge labels, exact: `Clean yes` (green), `Conflict` (amber), `Needs date` (grey), `Offered` (blue), `Approved` (green outline), `Declined` (muted), `Not an extension` (muted).
- Edit link on the interpretation line only while status is `READY` or `NEEDS_DATE`. Hide it when offered, approved or declined.
- After approval show the new end plus muted `was {originalEndAt}`. Terminal states show no option cards.
- Timeline: plain positioned rectangles, no chart library. Rows "Current trip", "Requested" (becomes "Extension" once approved), "Next booking".
  - Segments: current trip solid dark; requested extension striped indigo; cleaning buffer hatched grey, "2h cleaning"; Turo bar brown, Direct bar blue.
  - Conflict zone shaded light red; `Latest return` line only when a PARTIAL option exists.
  - No conflict: grey bar `Free until {day}` or `No later bookings`.
  - Labels never clip; shorten them instead.
- Option cards: titles, buttons and notes as in 11a. Unavailable options are struck through, but the reason line stays readable grey (contrast at least 4.5:1), never faded.
- Formats: money `$110.00` in tabular numerals; times `Sun 4 Oct, 9:00 PM`; `1 day` / `2 days`.
- Event log copy, exact: `Request received` · `Parsed: Sun 4 Oct, 10:00 AM` · `Conflict found: Turo booking Sat 3 Oct, 10:00 AM` · `Offer sent` · `Approved` · `Booking extended` · `Next renter moved to {vehicle}` · `Charged $178.00` · `Message queued` · `Declined: {reason}`
