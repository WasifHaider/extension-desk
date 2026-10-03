# Extension Desk

When an operator moves from Turo to direct bookings, they lose the machinery Turo ran for trip changes: in-app extension requests, host accept/decline, and late-return fees. On a direct site, renters just text the operator: *"can I keep the jeep till sunday night?"* The operator then has to decide quickly, usually from a phone, on four things: whether the car is actually free (counting direct bookings, Turo-synced bookings and cleaning time), what to charge, what to offer when the next renter is in the way, and how to tell everyone involved. A wrong yes strands the next renter; a slow answer means the car simply comes back late.

**Extension Desk turns a renter's text into a ready-to-approve decision.** The clean "yes" is one click. The real value is in the conflict case.

## Run it

```
git clone <this repo>
cd extension-desk
cp .env.example .env
npm run setup   # install, migrate, seed
npm run dev     # server on :3000, web on :5173
```

Open `http://localhost:5173`. It works with no API key: leave `GROQ_API_KEY` blank (or set `LLM_PROVIDER=none`) and every message lands as `NEEDS_DATE` — the operator picks the date manually and everything downstream (availability, pricing, approval, charge) works exactly the same.

Other commands: `npm test` (server tests), `npm run reset` (re-seed without reinstalling).

## Demo walkthrough

The seed pre-loads five renters against the demo inbox, each exercising a different path:

- **Maya** — Tesla, clean yes. Text *"can I keep it 2 more days"* → clean option, no conflicts → **Approve & charge** → confirmation appears in her phone thread.
- **Daniel** (pre-seeded, `READY`) — Wrangler, wants it till Sunday night, but a Turo booking starts Saturday 10 AM. Only a **partial** extension is offered (up to the Turo buffer); "move next renter" isn't offered at all, because Turo bookings are immovable. **Send offer** → Daniel's phone thread shows the offer → he replies **"yes"** → **Mark accepted** unlocks → charged.
- **Aisha** — RAV4, wants it till Sunday evening; the next booking is direct, not Turo, and a comparable car (CR-V) is free. The option offered is "move Tom to the CR-V" → **Approve** → both the renter and the reassigned next-renter get a queued message, and the event log shows the reassignment.
- **Sam** (pre-seeded, `NEEDS_DATE`) — vague message, no date in it → operator sends a clarifying question, or sets the date manually.
- **Carla** (pre-seeded, `NOT_EXTENSION`) — message isn't about extending at all ("where do I drop the keys") → greyed row, "handle manually."

**Playground** (top-right nav link): a second, fully isolated fleet/renter/booking set behind the same pipeline, with a booking builder to create/edit/cancel test bookings and a "Reset playground" button. Useful for trying scenarios beyond the five pre-seeded ones without touching the demo data.

## Design decisions

- **The LLM only reads the renter's message.** Availability, prices, dates/times shown in replies, and the options offered are all computed by code — no number the operator or renter sees comes from the model. *Why: a hallucinated price or date is the one failure mode that can't be caught by review before it reaches money or a renter.*
- **The operator approves every change; nothing is charged without a click.** *Why: a text message is not consent to a charge.*
- **Turo bookings are immovable** — a Turo guest's car can never be reassigned from outside Turo. *Why: Turo is a separate platform with its own commitment to that guest; Extension Desk has no authority over it.*
- **Approval re-checks availability inside a DB transaction**, and returns 409 + re-evaluates if the calendar changed. *Why: the operator may be looking at a stale screen by the time they click.*
- **Works with no API key** (`LLM_PROVIDER=none`): requests land as `NEEDS_DATE` and the operator enters the date; every other step is identical. *Why: parsing is a convenience, not a dependency — the decision engine has to work if the model is down.*
- **A partial extension is only charged after the renter accepts the offer** — enforced server-side, not just in the UI: "Mark accepted" stays disabled, and the approve endpoint itself refuses the charge (409), until an inbound message after the offer reads as an affirmative reply. *Why: never charge for something the renter didn't actually ask for, and don't trust the operator to have actually checked the thread before clicking.*
- **Money is integer cents; times are stored in UTC and displayed in `OPERATOR_TIMEZONE`.** *Why: avoids both floating-point money bugs and timezone drift between storage and display.*
- **Built only with Claude and Claude Code.** At runtime, the message parser calls Groq (free tier, low latency), but it sits behind a provider interface (`LlmProvider`) — set `LLM_PROVIDER=none` to run without any model. *Why: the assessment rule covers how the code was written, not what it talks to at runtime.*
- **No automatic replies to renters.** The only outbound messages are the five templates (offer, confirmation, decline, clarifying question, next-renter notice), and only ever sent on an explicit operator action. *Why: an automatic "checking the calendar…" reply implies a promise the operator hasn't made yet.*

## What I left out and why

| Left out | Why |
|---|---|
| `AnthropicProvider` | Cut per the spec's cut line to protect time; `LlmProvider` interface stayed provider-agnostic, so it's a drop-in addition later. Providers shipped: Groq + Null. |
| Login, multi-operator tenancy | Brief says skip auth; one hardcoded operator keeps focus on the feature |
| Real SMS (Twilio) | The renter-phone simulator exercises the same flow; the channel is just an adapter |
| Real payments (Stripe) | `PaymentProvider` interface + a mock implementation; Stripe would be an off-session charge to the card on file |
| Real Turo calendar sync | Turo bookings are seeded as already synced; pushing new blocks back to Turo is its own feature |
| Insurance API (Bonzah etc.) | The coverage window is extended in our DB only |
| Early returns, swapping the current renter's car mid-trip | The same engine could support them; cut for time |
| Taxes, deposits, late fees | Not needed to prove the decision flow |
| Per-vehicle time zones | One operator timezone |

## How I used Claude / Claude Code

Planned and specced in Claude, then built in phases with Claude Code from `docs/SPEC.md`. Built entirely with Claude and Claude Code. At runtime, the message parser calls Groq (free tier, low latency), but it sits behind a provider interface — set `LLM_PROVIDER=none` to run without any model.

## What I'd build next

- Real SMS (Twilio)
- Pushing calendar blocks to Turo
- A renter self-serve extension link
- Swapping the current renter's car
- Handling early returns
- Extension revenue reporting
