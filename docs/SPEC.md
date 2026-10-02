# Extension Desk — Build Spec

1Now Developer/Engineer assessment · Muhammad Wasif · deadline Sun 4 Oct 2026, midnight · **target: submit Sat 3 Oct morning**

---

## 1. The problem

When an operator moves from Turo to direct bookings, they lose the machinery Turo ran for trip changes: in-app extension requests, host accept/decline, and late-return fees. On a direct site, renters just text the operator: *"can I keep the jeep till sunday night?"*

The operator then has to decide quickly, usually from a phone, on four things:

- whether the car is actually free, counting direct bookings, Turo-synced bookings and cleaning time;
- what to charge;
- what to offer when the next renter is in the way;
- how to tell everyone involved.

A wrong yes strands the next renter. A slow answer means the car simply comes back late.

**Extension Desk turns a renter's text into a ready-to-approve decision.** The clean "yes" is one click. The real value is in the conflict case.

---

## 2. Scope

**In scope**

- Renter SMS simulator (stands in for real SMS).
- LLM parsing of the renter's message into a structured request, behind a provider interface. Groq is the default provider.
- Deterministic availability and conflict engine.
- Deterministic pricing quote.
- Operator inbox with options and approve / offer / decline actions.
- On approval: booking updated, mock charge, coverage window extended, templated messages queued, event log.

**Out of scope (and why)** — this list goes into the README:

| Left out | Why |
|---|---|
| Login, multi-operator tenancy | Brief says skip auth; one hardcoded operator keeps focus on the feature |
| Real SMS (Twilio) | Simulator exercises the same flow; channel is an adapter |
| Real payments (Stripe) | `PaymentProvider` interface + mock; Stripe would be an off-session charge to the card on file |
| Real Turo calendar sync | Turo bookings are seeded as already synced; pushing new blocks back to Turo is its own feature |
| Insurance API (Bonzah etc.) | Coverage window is extended in our DB only |
| Early returns, swapping the current renter's car mid-trip | Same engine could support them; cut for time |
| Taxes, deposits, late fees | Not needed to prove the decision flow |
| Per-vehicle time zones | One operator timezone |

---

## 3. Design principles (non-negotiable)

1. **The LLM only reads the renter's message.** Availability, prices, dates/times in replies, and options are computed by code. No number the operator or renter sees comes from the model.
2. **The operator approves every change.** Nothing is charged without a click.
3. **Turo bookings are immovable.** A Turo guest's car can't be reassigned from outside Turo.
4. **Re-check at approval time** inside a DB transaction. If the calendar changed since evaluation, refuse with 409 and re-evaluate.
5. **Works with no API key.** If the LLM is off or fails, the request lands as `NEEDS_DATE` and the operator picks the date; everything else works the same.
6. **Never charge for something the renter didn't ask for.** A partial extension is an *offer*; it is only charged after the renter accepts.
7. Money is integer cents. Times are stored in UTC and displayed in the operator timezone.
8. **Built only with Claude and Claude Code. Groq is a runtime dependency, not a build tool.** The assessment rule covers how the code is written. At runtime the parser calls Groq (free tier, low latency) through `LlmProvider`, so switching to Claude is one env var (`LLM_PROVIDER=anthropic`), and `none` runs without any model. State this openly in the README.
9. **The renter hears nothing until the operator acts.** No automatic acknowledgement messages ("checking the calendar…"). The only outbound messages are the templates in section 9: offer, confirmation, decline, clarifying question and next-renter notice.

---

## 4. Stack and repo layout

npm-workspaces monorepo:

```
/server      NestJS + Prisma + SQLite, Luxon, zod, groq-sdk
/web         Vue 3 + Vite + TypeScript (+ Tailwind)
/docs/SPEC.md
README.md
.env.example
CLAUDE.md
```

Root scripts:

- `npm run setup`: install, run Prisma migrate, seed.
- `npm run dev`: server on :3000 and web on :5173, run together via `concurrently`.
- `npm test`: server tests.
- `npm run reset`: re-seed.

**SQLite notes:** use `String` columns for enum-like fields (validated in TypeScript), and store JSON as text.

`.env.example`:

```
LLM_PROVIDER=groq            # groq | anthropic | none
GROQ_API_KEY=
GROQ_MODEL=                  # any current Groq chat model with JSON mode
ANTHROPIC_API_KEY=           # optional
OPERATOR_TIMEZONE=America/New_York
```

---

## 5. Data model

**Settings** (config file, single operator)

| Setting | Value |
|---|---|
| `operatorName` | `Hudson Drive Rentals` |
| `timezone` | `America/New_York` |
| `turnaroundBufferMinutes` | `120` |
| `maxExtensionDays` | `14` |
| `longTripTiers` | `[{ minDays: 7, pct: 10 }, { minDays: 28, pct: 20 }]` |
| `vagueTimeDefaults` | morning 10:00, afternoon 14:00, evening 18:00, night 21:00 |

**Vehicle**

- `id`, `name`, `category` (e.g. "Compact SUV"), `seats`, `dailyRateCents`, `plate`.

**Renter**

- `id`, `name`, `phone`.

**Booking**

- `id`, `vehicleId`.
- `renterId`: nullable for Turo.
- `source`: `DIRECT` | `TURO`.
- `status`: `CONFIRMED` | `ACTIVE` | `COMPLETED` | `CANCELLED`.
- `startAt`, `endAt`.
- `dailyRateCents`: snapshot at booking time.
- `coverageDailyCents`: 0 if none.
- `coverageEndsAt`: nullable.

**Message**

- `id`, `renterId`, `bookingId?`.
- `direction`: `IN` | `OUT`.
- `body`, `createdAt`.
- `status`: `RECEIVED` | `QUEUED`.

**ExtensionRequest**

- `id`, `bookingId`, `messageId`, `rawText`.
- `intent`: `EXTEND` | `EARLY_RETURN` | `OTHER`.
- `parsedJson`: raw model output.
- `originalEndAt`: the booking's end when the request was created. Never changes; drives the timeline's "current trip" segment and the "was …" label after approval.
- `interpretedEndAt?`, `interpretationNote`.
- `status`: see below.
- `optionsJson`: the evaluation result.
- `chosenOptionType?`, `chosenEndAt?`.
- `declineReason?`, `createdAt`, `decidedAt?`.

ExtensionRequest statuses:

| Status | Meaning |
|---|---|
| `NEEDS_DATE` | No usable date (unclear message, LLM off, or failed guardrail). Operator sets a date or sends a clarifying question |
| `NOT_EXTENSION` | Intent was something else (e.g. early return, "where do I drop the keys"). Shown greyed: "Handle manually" |
| `READY` | Evaluated; options available |
| `OFFERED` | Partial extension offered to the renter; waiting for their yes |
| `APPROVED` / `DECLINED` | Final |

**Charge**

- `id`, `bookingId`.
- `extensionRequestId`: UNIQUE, which guarantees no double charge.
- `amountCents`, `status`, `providerRef`.

**Event**

- `id`, `extensionRequestId?`, `bookingId?`, `type`, `detail`, `createdAt`.

---

## 6. LLM parsing

### Provider interface

```ts
interface LlmProvider {
  parseExtensionRequest(input: ParseInput): Promise<RawParse>;
}
```

There are three implementations, selected by `LLM_PROVIDER`:

- `GroqProvider`: **the default**, JSON mode.
- `AnthropicProvider`: same prompt. This is first on the cut line. If it's cut, the interface still makes it a drop-in later, and the README says so.
- `NullProvider`: always throws, so the request goes to `NEEDS_DATE`.

Keep the system prompt and the JSON schema in one shared file, so every provider uses identical instructions.

### What the model receives

- The renter's message.
- The vehicle name.
- The current trip end, as local ISO plus weekday.
- Now, as local ISO plus weekday.
- The operator timezone.

### What the model must return (JSON only)

```json
{
  "intent": "EXTEND | EARLY_RETURN | OTHER",
  "date": "YYYY-MM-DD or null",
  "weekday": "Sunday or null",
  "time": "HH:mm or null",
  "time_phrase": "morning | afternoon | evening | night | null",
  "clarifying_question": "string or null"
}
```

### Prompt rules

- Resolve relative days ("sunday", "tomorrow") against *now*.
- "N more days" means current end + N days.
- Never guess. If the day is unclear, set `date: null` and write a short, friendly `clarifying_question`.
- Output JSON only.

### Code-side resolution and guardrails (`resolveInterpretation`, pure function)

1. Validate with zod. Invalid JSON, schema mismatch or an API error → `NEEDS_DATE`.
2. **Weekday cross-check.** If `weekday` is present and doesn't match `date` → reject → `NEEDS_DATE`. This catches model date-arithmetic mistakes.
3. **Time resolution:**
   - explicit `time` wins;
   - otherwise `time_phrase` maps through `vagueTimeDefaults`;
   - otherwise keep the current end's time of day.
4. Build `interpretedEndAt` in the operator timezone and convert to UTC.
5. It must be after the current `endAt` and at most current end + `maxExtensionDays`. Otherwise → `NEEDS_DATE` with a note.
6. Write `interpretationNote` for the operator, e.g. `Read as Sun 4 Oct, 9:00 PM ("night" → 9:00 PM default)`.
7. If `intent` is not `EXTEND` → `NOT_EXTENSION`.

---

## 7. Availability and conflict engine (pure TS, fully unit-tested)

```ts
evaluateExtension({ booking, requestedEndAt, bookings, vehicles, settings }): Evaluation
```

### Definitions

- **Blocking bookings:** status `CONFIRMED` or `ACTIVE`, any source, excluding the booking itself.
- **`conflicts`:** blocking bookings on the same vehicle that overlap `[booking.endAt, requestedEndAt + buffer)`.
- **`latestFreeEnd`:** `min(conflicts.startAt) − buffer`, or `requestedEndAt` if there are no conflicts.
- **Vehicle free for a window `[a, b)`:** no blocking booking on that vehicle overlaps `[a − buffer, b + buffer)`.

### Options

Every option includes `newEndAt` and `quote`.

| Type | When available | Details |
|---|---|---|
| `FULL` | No conflicts | Gives the renter exactly what they asked for |
| `PARTIAL` | Conflicts exist and `latestFreeEnd ≥ booking.endAt + 1h` | `newEndAt = latestFreeEnd`, rounded down to 30 min |
| `REASSIGN_NEXT` | Exactly one conflict, it is `DIRECT` + `CONFIRMED`, and a comparable vehicle is free for that booking's whole window | Comparable = same `category`, `seats ≥` original, closest daily rate (ties: lower rate, then name). Current renter gets the full request; the next renter moves cars at the same price. Option carries `{ bookingId, fromVehicleId, toVehicleId }` |
| `DECLINE` | Always | — |

When an option isn't possible, the evaluation records a human-readable reason, and the UI shows the option struck through with that reason. Examples:

- "Next booking is on Turo — it can't be moved from here"
- "No comparable Compact SUV free Sat 10:00 AM – Mon 10:00 AM"
- "More than one booking in the way"

### Return shape

```ts
{ options, unavailable: { type, reason }[], conflicts, latestFreeEnd, nextBooking, freeUntil }
```

- `nextBooking`: the first blocking booking on the same vehicle that starts at or after `booking.endAt`, or `null`. After an approval, `booking.endAt` is the new end, so this is recomputed from there.
- `freeUntil`: `nextBooking.startAt − buffer`, or `null` when nothing follows. The UI shows it at day level ("Free until Wed 7 Oct").

---

## 8. Pricing (pure TS, unit-tested)

```ts
quoteExtension(booking, newEndAt, settings): Quote
```

- `billableDays = ceil(extraMinutes / 1440)`, i.e. 24-hour periods like the original rental. Using minutes keeps billing independent of DST.
- `totalTripDays = ceil((newEndAt − startAt) / 1440)`.
- **Long-trip tier:** the highest tier with `minDays ≤ totalTripDays` applies to the **extension days only**. Earlier days are not repriced; this is a documented choice.
- `rental = billableDays × dailyRateCents × (1 − pct/100)`.
- `coverage = billableDays × coverageDailyCents`.
- `total = rental + coverage`. No tax in v1.
- Each line is rounded half-up to cents.
- Return line items for the UI, for example:
  - `3 days × $110.00`
  - `Long-trip discount −10%`
  - `Damage cover 3 × $15.00`
  - `Total`

---

## 9. Actions

All actions run in a Prisma transaction and write Events.

### `POST /api/extension-requests/:id/approve { optionType }`

Valid for `FULL` and `REASSIGN_NEXT` from `READY`, and for accepting an `OFFERED` partial.

1. Status must be `READY`, or `OFFERED` when accepting a partial. Otherwise → 409. This makes approve idempotent, together with the unique `Charge.extensionRequestId`.
2. Reload bookings and re-run `evaluateExtension`. The chosen option must still exist with the same `newEndAt`. Otherwise → 409 "Calendar changed — re-evaluated", and the new options are saved.
3. Update `booking.endAt`. If the booking has coverage, extend `coverageEndsAt` too.
4. For `REASSIGN_NEXT`: set the next booking's `vehicleId`.
5. Create a charge via `PaymentProvider` (`MockPaymentProvider` returns `mock_ch_<cuid>`).
6. Queue templated outbound messages.
7. Status → `APPROVED`.

### `POST /api/extension-requests/:id/offer`

Only for `PARTIAL`. Queues the offer message (no charge) and sets status → `OFFERED`.

### `POST /api/extension-requests/:id/decline { reason }`

Queues the decline message and sets status → `DECLINED`.

### `PATCH /api/extension-requests/:id/interpretation { requestedEndAt }`

The operator sets or fixes the date. This re-runs guardrails and evaluation; status → `READY` (or stays `NEEDS_DATE` if the date is invalid). Only allowed while the status is `READY` or `NEEDS_DATE`; any other status → 409. The UI hides the Edit link in every other state.

### `POST /api/extension-requests/:id/clarify { body }`

Sends the clarifying question as an outbound message. It is prefilled from the model's `clarifying_question` or from a template, and the operator can edit it.

### Message templates

Templates are code, not LLM output. Times are formatted like "Sun 4 Oct, 9:00 PM".

- **FULL / REASSIGN, to the current renter:**
  > You're all set — your {vehicle} is now due back {newEnd}. ${total} has been charged to your card on file.
- **REASSIGN, to the next renter:**
  > Quick update for your trip starting {start}: you'll be in a {newVehicle} (same class) instead of the {oldVehicle}, same price. Reply if that doesn't work for you.
- **PARTIAL offer:**
  > Your {vehicle} has another booking right after you, so the latest return we can offer is {newEnd}. Extending to then is ${total}. Reply YES to confirm.
- **PARTIAL accepted:** same as the FULL confirmation.
- **DECLINE:**
  > Sorry, we can't extend this time — {reason}. Your return time stays {currentEnd}.
- **Clarify fallback:**
  > Happy to help! What day and time would you like to return the {vehicle}?

---

## 10. API summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/vehicles` | Fleet |
| GET | `/api/bookings?from&to` | Calendar data |
| GET | `/api/renters` | Simulator picker (renters with an active booking) |
| GET | `/api/messages?renterId=` | SMS thread |
| POST | `/api/messages/inbound { renterId, body }` | Stores the message, finds the renter's ACTIVE booking, creates an ExtensionRequest (recording `originalEndAt`), parses and evaluates it. Sends no reply |
| GET | `/api/extension-requests` | Inbox |
| GET | `/api/extension-requests/:id` | Detail incl. options, unavailable reasons, `originalEndAt`, `nextBooking`, `freeUntil`, timeline data, receipt line items (once approved), events |
| PATCH | `/api/extension-requests/:id/interpretation` | Operator sets the date |
| POST | `/api/extension-requests/:id/approve` | Approve |
| POST | `/api/extension-requests/:id/offer` | Offer a partial extension |
| POST | `/api/extension-requests/:id/decline` | Decline |
| POST | `/api/extension-requests/:id/clarify` | Send clarifying question |
| POST | `/api/dev/reset` | Re-seed |
| GET | `/api/meta` | Operator name, now, timezone, LLM provider status |

---

## 11. UI (single page, Vue 3)

### Header

"Extension Desk", the current operator time ("Thu 1 Oct, 7:45 PM ET"), an LLM status pill ("Groq" / "Manual mode") and a **Reset demo** button.

### Inbox (left)

Requests, newest first, each with a badge:

| Badge | Colour |
|---|---|
| Clean yes | green |
| Conflict | amber |
| Needs date | grey |
| Offered | blue |
| Approved | — |
| Declined | — |
| Not an extension | greyed |

### Detail (center)

From top to bottom:

1. Renter, vehicle and current trip ("2023 Jeep Wrangler · due back Fri 2 Oct, 10:00 AM").
2. The renter's message as a chat bubble.
3. The interpretation line, with an **Edit** button that opens a datetime picker and re-evaluates.
4. A **vehicle timeline strip** (about 5 days around the request) showing:
   - current trip (solid);
   - requested extension (striped);
   - turnaround buffer (hatched grey);
   - the next booking, labelled **Turo** or **Direct** with the renter's name.
5. **Option cards**:
   - each available option shows its new return time and line-item price, with the right button: **Approve & charge**, **Send offer**, or **Mark accepted** (for `OFFERED`);
   - unavailable options are shown struck through with their reason;
   - Decline has a reason input.
6. For `NEEDS_DATE`: the clarifying-question box (editable, **Send**) plus **Set date manually**.
7. Event log at the bottom.

### Renter phone (right)

A phone-frame panel:

- pick a renter with an active trip;
- see their SMS thread, with inbound and queued outbound messages;
- type and send.

Sending creates the request live, and the inbox updates.

---

## 11a. Design rules (locked from the Claude Design review)

These come from the approved frames. **Where they differ from section 11, this section wins.** Colour tokens, type scale and spacing come from the Claude Design handoff.

### Shell

- **Header:** "Extension Desk" · operator name from settings · operator clock ("Thu 1 Oct, 7:45 PM ET") · parser pill ("Parser: Groq", "Parser: Claude" or "Manual mode") · **Reset demo**.
- **Inbox header:** "Extension requests" with the total count as a number (never "?").
- **Inbox row:** renter name, car, one-line preview (ellipsis), received time ("7:41 PM" if today, short weekday like "Wed" if earlier), status badge. The selected row has a left accent bar. `NOT_EXTENSION` rows are greyed.
- **Badge labels (exact):** `Clean yes` (green, READY with no conflicts), `Conflict` (amber, READY with conflicts), `Needs date` (grey), `Offered` (blue), `Approved` (green outline), `Declined` (muted), `Not an extension` (muted).

### Detail

- **Header:** renter name, plus a `Damage cover` tag if the booking has cover. Below it: `{vehicle} · Due back {end}`. **After approval, show the new end and, muted, `was {originalEndAt}`.**
- **Message bubble** with a meta line ("Today, 5:12 PM · via SMS").
- **Interpretation line:** `READ AS {end}` plus the note in parentheses, e.g. `('night' → 9:00 PM default)`. When there is no conflict, append `· free until Wed 7 Oct` (never "nothing booked after"). The **Edit** link appears only while status is `READY` or `NEEDS_DATE`.
- **Terminal states (no option cards shown):**
  - **Approved:** green banner `Extended to {end} · ${total} charged · confirmation sent`, then a one-line receipt under it: `2 days × $89.00 · Total $178.00`. With cover: `2 days × $89.00 + cover 2 × $15.00 · Total $208.00`.
  - **Declined:** muted banner with the reason.
- **Needs date (`NEEDS_DATE`):** no interpretation line. Show an editable clarifying-question box (prefilled from the model's question or the template) with **Send question**, plus **Set date manually** (datetime picker).
- **Formats:** money `$110.00` in tabular numerals; times `Sun 4 Oct, 9:00 PM`; `1 day` / `2 days`.

### Timeline strip (plain positioned rectangles, no chart library)

- **Window:** starts 00:00 on the day the original trip ends; ends 24:00 on the day after the later of the requested/new end. Minimum 4 days, maximum 8. Anything past the right edge is clipped with an arrow. Day labels along the top ("Fri 2", "Sat 3").
- **Rows:** "Current trip", "Requested" (relabelled "Extension" once approved), "Next booking". All row labels are neutral grey.
- **Current trip:** solid dark segment from the window start to `originalEndAt`.
- **Requested extension:** striped indigo segment `originalEndAt → requestedEndAt`, labelled "Requested extension". After approval: a lighter green striped segment to the new end, labelled "Extension · to Sun 4 Oct, 10:00 AM". It is always a separate segment from the current trip.
- **Next booking:** solid bar, brown for Turo and blue for Direct. Labels: `Turo guest · Sat 10 AM → Mon 10 AM` or `Direct · Tom R. · Sat 10 AM → Mon 10 AM`. Text must never clip: shorten the label (drop the end time) rather than overflow.
- **Cleaning buffer:** hatched grey segment of `turnaroundBufferMinutes` immediately before the next booking, labelled "2h cleaning".
- **Conflict zone:** where the requested extension plus buffer overlaps the next booking, shaded light red across the rows. **Latest-return marker:** a vertical line at `latestFreeEnd`, labelled `Latest return · Sat 3 Oct, 8:00 AM`, drawn only when a PARTIAL option exists.
- **No conflict:** a neutral grey bar labelled `Free until Wed 7 Oct`, running from (extension end + buffer) to `freeUntil`, clipped at the window edge with an arrow. If `freeUntil` is null, label it `No later bookings`.
- **Amber means conflict only** (badge and conflict zone). Never use it for neutral labels.

### Option cards

- **Title:** `Extend until {newEnd}` (FULL and PARTIAL) or `Full extension + move {name} to the {vehicle}` (REASSIGN_NEXT). On the right, muted: `{First name} asked for {requestedEnd}`. Never repeat the title's time there.
- **Body:** line items right-aligned in tabular numerals (`1 day × $110.00`, `Damage cover 1 × $15.00`, a discount line when applicable) and a bold total. REASSIGN_NEXT adds the note `Next renter keeps the same price · same class ({category})`.
- **Buttons:**
  - FULL and REASSIGN_NEXT: `Approve & charge ${total}`.
  - PARTIAL: `Send offer`, with the note `Renter confirms before they're charged`.
  - OFFERED: `Mark accepted`, with the note `Waiting for {first name} to reply YES`.
- **Unavailable options:** muted, struck-through title; **the reason line in normal readable grey, not faded** (contrast ≥ 4.5:1). It must stay legible in a compressed screen recording. Exact titles: `Full extension to {requestedEnd}` and `Move next renter to another car`.
- **Decline request:** a text button below the cards that opens a reason input.

### Event log

Sits directly under the content (not pinned to the bottom). Small muted rows of time + text. Exact copy:

`Request received` · `Parsed: Sun 4 Oct, 10:00 AM` · `Conflict found: Turo booking Sat 3 Oct, 10:00 AM` · `Offer sent` · `Approved` · `Booking extended` · `Next renter moved to {vehicle}` · `Charged $178.00` · `Message queued` · `Declined: {reason}`

### Renter phone (demo tool)

- Panel title "Demo · Renter's phone" with a tag "Demo tool, not in product". The phone frame is titled "Text Message · Hudson Drive".
- Renter dropdown ("Maya L. · Tesla Model 3"), thread (renter messages left, operator messages right), input "Text message" + **Send**.
- **No automatic reply.** The thread only shows messages the operator's actions send (principle 9).

### Responsive

Below ~900px: single column, the inbox becomes its own list screen, and the phone panel is hidden. This is cuttable (section 17).

---

## 12. Seed data (all times relative to when the seed runs)

The demo must work on whatever day the reviewer runs it. Pre-seeded message text is generated from the computed dates (correct weekday names).

### Fleet

| Vehicle | Category | Seats | $/day |
|---|---|---|---|
| Tesla Model 3 | EV Sedan | 5 | 89 |
| Jeep Wrangler | SUV | 5 | 110 |
| Toyota RAV4 | Compact SUV | 5 | 75 |
| Honda CR-V | Compact SUV | 5 | 72 |
| Toyota Corolla | Economy | 5 | 55 |
| Nissan Rogue | Compact SUV | 5 | 70 |
| Ford Mustang | Sports Coupe | 4 | 130 |
| Kia Soul | Economy | 5 | 60 |

### Renters

Display names, as in the design: Maya L., Daniel K., Aisha M., Sam P., Priya N., Leo W., Carla S., and Tom R. (the direct renter booked after Aisha). Phone numbers are fake (555 range). Turo bookings have no renter; the UI shows "Turo guest".

### Scenarios

Day numbers are relative to today in the operator timezone.

**A. Clean yes (typed live in the demo)**

- Maya has the Tesla, ACTIVE, ending day+1 at 10:00.
- Her next booking on that car starts in 6 days.
- Suggested live text: "loving the tesla!! can i keep it 2 more days?"

**B. Turo conflict (pre-seeded request)**

- Daniel has the Wrangler, ACTIVE, ending day+1 at 10:00, with damage cover at $15/day.
- A TURO booking on the Wrangler starts day+2 at 10:00.
- Message: "any chance I can keep the jeep till {weekday of day+3} night?"
- Expected result:
  - PARTIAL until day+2 08:00;
  - REASSIGN struck through (Turo);
  - FULL unavailable.

**C. Direct conflict that can be reassigned (typed live)**

- Aisha has the RAV4, ACTIVE, ending day+1 at 10:00.
- A DIRECT booking (Tom) on the RAV4 runs day+2 10:00 → day+4 10:00.
- The CR-V is free.
- Suggested live text: "can I keep the RAV4 until {weekday of day+3} evening?"
- Expected result: PARTIAL **and** REASSIGN_NEXT (Tom → CR-V).

**D. Vague (pre-seeded request)**

- Sam has the Corolla, ACTIVE.
- Message: "hey could I keep it a bit longer?"
- Expected result: `NEEDS_DATE` with a clarifying question.

**E. Not an extension (pre-seeded, received yesterday)**

- Carla has the Kia Soul, ACTIVE.
- Message: "where do I drop the keys?"
- Expected result: `NOT_EXTENSION`, shown greyed.

**F. Offered, waiting for the renter (pre-seeded, received a few hours ago)**

- Priya has the Nissan Rogue, ACTIVE, ending day+1 at 10:00.
- A TURO booking on the Rogue starts day+2 at 10:00.
- Message: "could I have it until {weekday of day+2} noon?"
- Expected result: `OFFERED`. A partial extension until day+2 08:00 was already sent and nothing is charged yet. The operator can click **Mark accepted**.

**G. Declined (pre-seeded, received yesterday)**

- Leo has the Ford Mustang, ACTIVE, ending day+1 at 10:00.
- A TURO booking on the Mustang starts day+1 at 12:00, so no partial extension is possible.
- Message: "extend through {weekday of day+4} please"
- Expected result: `DECLINED`, with the decline template already queued to the renter.

**Seed rules**

- Pre-seeded requests B, D, E, F and G store their parse results and options directly, so the seed **never calls the LLM** and works offline.
- Their `createdAt` values are spread so the inbox shows both clock times (B and D within the last hour, F a few hours ago) and weekday labels (E and G yesterday).
- Maya (A) and Aisha (C) have ACTIVE bookings but no request until typed live. After the Loom's two live messages the inbox has 7 requests, matching the design frames. **Reset demo** returns it to 5.

---

## 13. Tests (`npm test` must pass)

**Engine**

- FULL when nothing follows.
- FULL exactly at the buffer boundary (`requestedEnd == next.start − buffer`).
- PARTIAL when a Turo booking is in the way; REASSIGN unavailable with the Turo reason.
- REASSIGN when the next booking is DIRECT and a comparable car is free; unavailable when the comparable car is busy.
- CANCELLED bookings don't block.
- Two bookings in the way → no REASSIGN.

**Pricing**

- 59 h → 3 billable days.
- Crossing the 7-day tier discounts the extension days only.
- Coverage line is included only when the booking has coverage.

**Parsing guardrails**

- Weekday mismatch → `NEEDS_DATE`.
- "night" → 21:00.
- No time given → keeps the current end time.
- Requested end before the current end → `NEEDS_DATE`.
- Beyond the max → `NEEDS_DATE`.
- Provider throws → `NEEDS_DATE`.

**Actions**

- Double approve → the second call is 409 and exactly one Charge exists.
- Calendar changed between evaluate and approve → 409 and the options are refreshed.
- An OFFERED partial is not charged until accepted.

---

## 14. Build phases and schedule

Use one Claude Code session per phase, and start each with `/clear`. The spec carries the context, so short sessions use far less of the usage limit than one long one. Commit after every phase.

| When | Phases | Why this order |
|---|---|---|
| **Thu night** | 1 + 2 | Scaffold, plus the engine and pricing with passing tests. This is the core of the submission, so most of the risk is gone tonight |
| **Fri** | 3 + 4, then 5 | Parsing and actions first. UI is the longest phase, so it gets the whole evening. Protect Phase 5's time over polishing earlier phases |
| **Sat morning** | 6 → Loom → submit | README, a fresh-clone run of the setup commands, one rehearsal of the demo script, record, submit the repo + Loom, reply to the email |

If a phase runs long, apply section 17 (cut line) instead of pushing the schedule.

**Phase 1 — Scaffold**

- Monorepo, Nest app, Vue app, Prisma schema (section 5), seed (section 12), root scripts, `.env.example`, `CLAUDE.md`.
- *Done when:* `npm run setup && npm run dev` shows a page listing seeded bookings.

**Phase 2 — Engine + pricing**

- Build in `server/src/extensions/engine/` as pure functions with no Nest or Prisma imports.
- Write the tests from section 13 (Engine and Pricing).
- *Done when:* tests pass.

**Phase 3 — Parsing + inbound**

- Provider interface, Groq and Null providers, `resolveInterpretation` with guardrails and tests, the inbound message endpoint, and request creation.
- *Done when:* POSTing scenario A's text creates a READY request (with a key), and a NEEDS_DATE request with `LLM_PROVIDER=none`.

**Phase 4 — Actions**

- Approve / offer / decline / interpretation / clarify, run in transactions, plus mock payments, templates, events and the action tests.
- *Done when:* all tests pass.

**Phase 5 — UI**

- Inbox, detail, timeline strip, option cards, event log, renter phone, reset. Build from the approved Claude Design frames and tokens; section 11a wins over section 11.
- *Done when:* the demo script (section 16) runs end to end in the browser.

**Phase 6 — README + polish**

- README (section 15), then one full run-through of the demo script from a fresh clone.

---

## 15. README must include

1. The problem, in one paragraph (section 1).
2. **Run it**: clone → `cp .env.example .env` → `npm run setup` → `npm run dev`. Note that it works without a key in manual mode.
3. The demo walkthrough.
4. Design decisions (section 3), each with a one-line why.
5. What I left out and why (section 2 table).
6. How I used Claude / Claude Code: planned and specced in Claude, then built in phases with Claude Code from `docs/SPEC.md`. Include this line as-is, or close to it:
   > Built entirely with Claude and Claude Code. At runtime, the message parser calls Groq (free tier, low latency), but it sits behind a provider interface — set `LLM_PROVIDER=anthropic` to run it on Claude instead, or `none` to run without any model.
7. **What I'd build next:**
   - real SMS (Twilio);
   - pushing calendar blocks to Turo;
   - a renter self-serve extension link;
   - swapping the current renter's car;
   - handling early returns;
   - extension revenue reporting.

---

## 16. Loom demo script (≤ 3:00) — also the acceptance test

| Time | Segment |
|---|---|
| 0:00–0:20 | Who I am |
| 0:20–0:45 | The problem: going direct means losing Turo's extension machinery; a wrong yes strands the next renter, a slow answer means late returns; the conflict case is where the money is |
| 0:45–1:05 | **Live:** Maya texts "can I keep it 2 more days" → Clean yes → Approve & charge → confirmation appears in her phone thread |
| 1:05–1:45 | **Daniel (pre-seeded):** wants it till Sunday night, Turo booking Saturday 10 AM → partial offer until 8 AM (buffer shown on timeline), "move next renter" struck through because it's Turo → Send offer → Mark accepted → charged |
| 1:45–2:20 | **Live:** Aisha asks till Sunday evening; next renter is direct → "Move Tom to the CR-V" → Approve → both messages queued, event log shows the reassignment |
| 2:20–2:35 | Sam's vague message → Needs date → send clarifying question |
| 2:35–3:00 | Design choices (LLM only reads, code decides, operator approves, re-check before charging) + what's left out |

---

## 17. Cut line

If you fall behind, cut in this order, and list anything cut in the README's "left out" table:

1. `AnthropicProvider` (keep Groq + Null only).
2. Clarifying-question flow: vague messages get manual date entry only.
3. Scenario E (not an extension) and its UI state.
4. Long-trip discount tiers: use a flat daily rate.
5. Event log panel in the UI. Keep writing Events to the DB.
6. Timeline strip: replace with one line, e.g. "Next: Turo booking, Sat 10:00 AM".
7. Mobile (390px) layout: ship desktop only.

**Never cut** (these are what get defended in the interview):

- FULL / PARTIAL / REASSIGN_NEXT logic.
- The Turo-can't-be-moved rule.
- The re-check inside the approval transaction.
- Offer-then-accept for partials.
- Engine and pricing tests.
- A seed that works with no API key.

---

## Appendix — CLAUDE.md (repo root)

```
# Extension Desk
- Full spec: docs/SPEC.md. Build only the phase you're asked for.
- Engine and pricing are pure functions in server/src/extensions/engine — no Nest/Prisma imports there.
- Money is integer cents. Store UTC, display in OPERATOR_TIMEZONE (Luxon).
- The LLM never produces prices, times shown to users, or options. It only parses the renter's message.
- SQLite: enum-like fields are Strings validated in TS; JSON stored as text.
- Every state change writes an Event. Approvals run in a transaction and re-check availability.
- Run `npm test` before saying a phase is done.
- Default LLM provider is Groq (runtime only). Keep the prompt/schema provider-agnostic in one shared file.
- If asked to cut scope, follow section 17 of the spec in order; never cut the "never cut" list.
- UI: follow spec section 11a and the Claude Design frames. Amber means conflict only. No automatic reply messages to renters. Hide the Edit link once a request is approved, offered or declined.
```
