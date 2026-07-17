# Seat Booking App — project context for continued development

Internal office "Mobile Office" seat booking web app for ~5 teams (SA, DEV, Scrum, พี่นก/App Owner,
Tester) sharing hot-desk seats across 3 floors (F5, F24, F32). Built to replace a Google Sheet
that manually tracked weekly seat rotation. This file exists so a fresh agent (or human) can pick
up work without re-deriving the source-data analysis that already happened — read this before
touching `data/seed.json` or the rotation logic.

## Stack & running it

Next.js 14 (App Router) + TypeScript + Tailwind + SQLite via `better-sqlite3`. No ORM, no auth
(open access — identity is just a client-picked name stored in `localStorage`, see
`lib/identity.ts` / `components/PersonPicker.tsx`). Intranet-only, no cloud deploy.

```bash
npm install
npm run seed   # one-time: loads data/seed.json into seatbooking.db (skips if already seeded;
               # pass --force to re-seed, but only after deleting seatbooking.db* first —
               # it does NOT dedupe employees on re-run)
npm run dev
```

If you change `lib/schema.sql` or `data/seed.json`, you must delete `seatbooking.db*` (the `.db`,
`-wal`, `-shm` files) and re-run `npm run seed` — the seed script has no migration path.

## Data model (`lib/schema.sql`)

- `floors`, `seats` — `seats.grid_row`/`grid_col` are the ONLY fields that determine visual
  layout (see "Floor plan accuracy" below). `row_letter`/`col_number` are just the seat's label
  (e.g. "K2") and must never be used to infer position — a seat's letter can be a vertical column
  on the real floor plan while another seat's letter is a horizontal row.
- `teams`, `employees` — `employees.group_number` (1-4) drives the WFH rotation (see below).
- `team_seats` — each team's fixed, ordered pool of seats it rotates through (`pool_order`).
- `employee_rotation` — `initial_pool_index`: where in the team's seat pool an employee started,
  captured once at seed time from the source sheet's current-week snapshot. Employees without a
  row here have no auto-rotation seat (new hires added from the roster file, or people whose
  original seat turned out not to physically exist — see below).
- `bookings` — the ONLY table written at runtime. Stores explicit user actions only:
  `status='booked'` (claim a seat, overrides auto) or `status='released'` (explicitly vacate an
  auto-assigned seat). Auto-assignment for weeks without an override is computed on the fly, never
  persisted — there's no "generate all future weeks" step, unlike the original sheet.

## Rotation logic (`lib/rotation.ts`)

Two independent layers, both computed live per (employee, week) — nothing is precomputed/stored
beyond `initial_pool_index` and `group_number`:

1. **Seat rotation**: `seat = team_seat_pool[(initial_pool_index + weeks_since_seed) % pool_size]`.
   Simple round-robin through the team's fixed seat pool. This is a deliberate simplification —
   see "Why not the original algorithm" below.
2. **WFH group cycle**: each employee has `group_number` 1-4 (assigned evenly/deterministically at
   seed time, NOT the company's real per-person assignment — see "Known gaps" below). Each week,
   exactly 1 of the 4 groups is WFH and the other 3 are in-office, cycling every 4 weeks
   (`wfhGroupForWeek` in rotation.ts). This matches the real policy: office 3 weeks, WFH 1 week per
   person, anchored so `getSeedWeekStart()` (2026-07-06) is a group-4-WFH week.

Effective assignment for a seat in a given week (`getSeatAssignment` in `lib/queries.ts`):
explicit `bookings` row wins (booked > released-as-open) → else auto-rotation result (only if the
employee's group is in-office that week) → else the seat shows as open/bookable by anyone.

## Floor plan accuracy — read this before touching seat positions

`data/seed.json`'s `seats[].grid_row`/`grid_col` were derived by extracting word bounding boxes
(`pdftotext -bbox`) from the real office floor-plan PDF the user provided
(`~/Downloads/Mobile Office 2025-V2 - ผังที่นั่ง-กพ.2026.pdf`) and clustering seat-code x/y
coordinates into row/column bins — NOT by parsing the row-letter+number pattern in the seat code
(that was the first approach and it was wrong: some floor zones lay out a letter as a *vertical
column* of desks, not a horizontal row, so letter/number can't be trusted for layout).

**Clustering tolerance matters and already bit us once**: x-clustering tolerance was originally
4pt, which caused a stray coordinate from an unrelated row to land between two real columns and
split what is actually one continuous row (F32's K/L/M/N/E rows) into two with a fake gap in the
middle. Fixed by raising x-tolerance to 10 (y-tolerance stayed at 4 — rows are packed close enough
that a larger y-tolerance would merge genuinely distinct back-to-back rows like K and L). If you
ever re-derive this data: real intentional adjacent-seat gaps on this floor plan run ~16-26pt,
real corridor/aisle gaps run ~42-49pt, and cross-row alignment noise is ~4-8pt — keep any
tolerance comfortably inside the 8-16pt band, and **visually diff against the PDF** (render the
floor with Playwright and eyeball it against a `pdftoppm`-rendered crop of the source PDF) before
trusting a re-cluster; the gap analysis script used is not checked in anywhere.

Two seats that appeared in the booking-history CSV (F5-G2, F5-K2) turned out not to exist at all
in the real floor-plan PDF — removed from `seats`/`team_seats`; the two affected employees just
have no `employee_rotation` row now (they self-book like any new hire). Conversely 7 seats exist
in the real floor plan but were never used in the booking-history rotation (F24-C3/C4, F32-Q4/Q5,
F5-I2/L2/M1) — they're in `seats` for map completeness but belong to no team's pool, so they show
as generically open/bookable by anyone.

## Source data & how the roster was built

Three source files (all in `~/Downloads/`, not checked into this repo):
- `Mobile Office 2025-V2 - Booking Seat.csv` — the original weekly rotation schedule (~1340 rows,
  one row per week per team, going back to 2025-09-29). Used to derive `team_seats` pools and each
  seeded employee's `initial_pool_index`, snapshotting the week containing 2026-07-06 as "current".
- `Mobile Office 2025-V2 - จัดกลุ่ม V3.csv` (+ matching PDF) — a cleaner authoritative team-roster
  export (SA 35, Dev 44, Scrum 25, App Owner 14, Tester 29 = 147 people). Cross-checked against
  what the booking-history snapshot had produced and used to add 52 people who were legitimately
  on a team but hadn't shown up in that one week's snapshot. **Its "กลุ่ม 1-4" (WFH group)
  sub-table is incomplete in the source file itself (only ~3 sample rows, not full membership) —
  that's why `group_number` is auto-assigned evenly rather than reflecting reality.**
- `Mobile Office 2025-V2 - ผังที่นั่ง-กพ.2026.pdf` — real floor-plan for grid positions (see above).

Two real names in the booking history (พัชชา วรชาครียนันท์, สรายุทธ จิตราธนวัฒน์) don't appear in
the V3 roster at all — kept them anyway since they have real historical seat data; just flagging
that they're an unreconciled discrepancy, not a bug.

**Not yet imported** (explicit user decision, "ยังไม่ต้องตอนนี้"): ~35-40 people who have a fixed
(non-rotating) seat every week, and the gap between the 187-person real headcount the V3 file
states vs the 147 actually in the rotating roster. If asked to add them, they need a different
model than `employee_rotation` (a fixed seat isn't a rotation position, it's "always this seat,
every week, no WFH group").

## Why not the original sheet's rotation algorithm

The original CSV's per-team seat sequence looked deterministic at first glance but isn't: cycle-
over-cycle the same seat's occupant sometimes shifts by an odd offset and sometimes gets replaced
by someone never seen before, consistent with a human manually patching exceptions (leave,
resignation, ad-hoc swaps) directly into the sheet rather than a formula. Confirmed with the user
and deliberately replaced with the simple modular round-robin described above, plus self-service
booking/release on top so people can correct the auto-assignment themselves.

## Known simplifications / things a future session might be asked to fix

- No auth. `PersonPicker` identity is per-browser localStorage, not a real login.
- `group_number` (WFH group) is auto-split, not the company's real per-person assignment — real
  data doesn't exist in exportable form (see above). If it ever does, migrate by adding a
  `group_number` override per employee (schema already supports 1-4 per employee; just need the
  right source list) rather than rearchitecting.
- Fixed-seat employees and the ~35-40-person headcount gap are not modeled at all (see above).
- `/admin` has no auth guard — basic employee CRUD + booking-override viewer only, by design for
  now (open access matches the rest of the app).
- Multiple teams can have the same seat in their `team_seats` pool (a few seats are shared between
  teams historically); `getSeatAssignment` just picks whichever team's auto-rotation resolves
  first if there's a same-week collision — not a hard conflict, just worth knowing if seat
  assignments ever look like they're double-booked between two teams.

## Verification approach used so far

No automated test suite. Verified by: `npx tsc --noEmit`, direct `better-sqlite3` queries against
the seeded DB to sanity-check counts/duplicates, and the `pw` CLI (Playwright wrapper) to drive
the actual running dev server and screenshot/click through booking flows — compare any floor-plan
changes against a `pdftoppm`-rendered crop of the source PDF, not just "does it look like a grid."
