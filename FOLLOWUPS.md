# Follow-ups / known loose ends (2026-07-17)

Working notes from importing Floor 32 and the DEV attendance schedule from
`Mobile Office 2025-V3.xlsx` (in `~/Downloads`, not checked into this repo).
Read this before touching `data/dev_attendance.json`, F32 seat data, or the
`/team/[teamId]/schedule` page.

## Open questions

_(none open right now — see resolved section below)_

## Known limitations

- **Real attendance data only covers 42 rounds** (`data/dev_attendance.json`,
  weeks 2026-08-03 through 2027-05-17). The schedule page
  (`/team/[teamId]/schedule`) silently falls back to the synthetic 6-group WFH
  rotation for any week beyond that — will need either an updated export from
  the sheet, or an explicit rule for what happens after round 42.

- **F32 fixed-name placeholders for other teams** (~19 seats: SA employees like
  "SA : ณภัค (ทราย)", plus unlabeled names like เฉลิมพงษ์, ธนาวุฒิ's
  neighbors, etc.) are just static text labels — not linked to real `employees`
  rows, since only DEV is modeled in this app right now. If SA/Tester/Scrum/
  AppOwner/AS400 ever get imported as real teams, those F32 seats need proper
  employee records the same way we did for the 5 DEV names fixed to F32.

- **group_number for the 4 manually-added DEV employees** (อภิมุข ดำอ่อน,
  ธนาวุฒิ ประเสริฐสังข์, พัลลภ นุตาลัย, อัญดาธร ชมภูวงค์) is just round-robin
  assigned — meaningless in practice since all 4 are fixed-seat leads (fixed
  seats bypass the WFH group calc entirely), but stored because the schema
  requires a value.

- **`data/seed.json` is manually kept in sync with the live `seatbooking.db`**
  every time a fix like this lands (fixed-seat renames, new employees, new
  seats). There's no automated check that they match — if they ever drift,
  a fresh `npm run seed` after deleting `seatbooking.db*` would reproduce the
  wrong (older) state. Worth spot-checking parity if anything here looks off.
  **This has already drifted**: `seed.json` still has no `F24` entry at all
  (predates both today's SA/Scrum/Tester/พี่นก onboarding and the floor 24
  redraw below), and none of that floor 24 data is captured there either. A
  fresh reseed from `seed.json` today would reproduce an app missing floor 24
  entirely. Resyncing `seed.json` for all of today's work is a separate,
  larger task from the floor 24 redraw — flagging so it isn't lost.

## What's already resolved (don't re-litigate)

- DEV's F32 fixed seats: E4→อภิมุข ดำอ่อน, E5→สหัสวรรษ หิรัญเพชร,
  F5→อาภัสรา โมรัษเฐียร, F6→กัญญาภัค ประสมศรี, plus ธนาวุฒิ ประเสริฐสังข์
  fixed at the seat next to E5.
- F5 also had 3 mislabeled pool seats (F3/F4/G4) that were actually fixed to
  วสันต์ เพียรมาก, พัลลภ นุตาลัย, อัญดาธร ชมภูวงค์ — fixed, removed from the
  rotation pool. F5-I2 was a missing real pool seat — added. วรัชยานันทน์
  พิภัชสิทธา (existing employee id 1) also has a fixed F5 seat.
- Schedule page attendance must count **both** F5- and F32-prefixed seat rows
  from the Booking Seat sheet — excluding F32 rows entirely (an earlier
  extraction bug) wrongly marked people WFH on weeks they were actually
  scheduled to attend (caught via จาตุรงค์ ทองแดง, week of 2026-08-31).
- "บดินทร์" name mismatch was confirmed same person — renamed
  `บดินทร์ รินเย็น` → `บดินทร์ อิทธิพลชยานันท์` (his updated surname) in both
  the DB and `data/seed.json`. He now gets real attendance data instead of
  the synthetic fallback.
- **(2026-07-23) The "4 employees with zero coverage" question above is
  resolved**: ดรุฑ จงบรรเจิดเพชร, พีรพัฒน์ กิจพร้อมผล, คมชาญ จันทร์นาค,
  โอภาส ตรีนัย moved off the DEV team to "พี่นก" (confirmed — they show up
  under that team's column in the "Booking Seat" sheet, not DEV's). Set
  `active = 0` for all 4 in the live DB (this app only models DEV, so there's
  no team to move them to — same treatment as the other already-inactive
  employees). No `data/seed.json` change needed since `active` was never
  seed-tracked to begin with (seed always inserts `active = 1`; toggling is a
  runtime admin action, same as how the pre-existing inactive employees
  — ธนากร เหรียญรุ่งเรือง, พีชนก ชูสมบัติ, ภูวสิษฏ์ ผลรุ่งเจริญวงษ์,
  รัชชานนท์ บุญจำรูญ — got there).
- **(2026-07-23) Real per-person group_number import**: `Mobile Office
  2025-V3 (1).xlsx`'s "รอบที่นั่ง DEV" sheet turned out to hold the *real*
  per-person group assignment (not just attendance) for the 30 rotating DEV
  employees — confirmed the DB's previous group_number was synthetic
  round-robin and disagreed with the real sheet for 26/30 people. Synced
  `employees.group_number` to match the sheet for all 30 (source of truth
  per explicit instruction), and mirrored the same values into
  `data/seed.json` so a fresh reseed reproduces them (previously only the 4
  fixed-seat leads had explicit `group_number` there — see the limitation
  below, still true for those 4).
- **(2026-07-23) Real per-week seat data imported**: added
  `data/dev_seat_rounds.json`, the same sheet's actual assigned desk per
  person per week for its 22 covered rounds (2026-08-03 – 2026-12-28, F5 desks
  only — the 5 "กลุ่ม fix" rows were left out since those people are already
  handled correctly by the existing fixed-seat mechanism regardless of week).
  `getEmployeeWeekSeat`/`getSeatAssignment` now prefer this real assignment
  over the generic `computeAutoSeat` rotation algorithm when both an
  employee/seat *and* the week fall inside this file's coverage, falling back
  to the algorithm otherwise (same "real data wins, else synthetic fallback"
  pattern as `dev_attendance.json`). Worth revisiting once an updated export
  covering rounds past 2026-12-28 shows up.
- **(2026-08-03) Floor 24 redrawn from the real physical floor plan**: floor 24
  previously only had the 17 SA/Scrum rotation seats imported earlier today —
  no AS400/PMO/PM/Infra desks, no fixed-seat leads, and row E was missing
  entirely (grid_row was an ad-hoc 1-5 sequence with a gap, not real
  coordinates). Rebuilt from `Mobile Office-V3-20260801.xlsx`'s "ผังที่นั่ง-เริ่ม
  สค. 2026" sheet (rows 51-75): floor 24 now has 50 seats total, grid_row 1-10
  (row-letters A-J), matching the real desk layout. Added 5 new SA fixed-seat
  employees discovered in the sheet who had no `employees` row yet — รสรินทร์
  เจิ้ง, บรมเศรษฐ์ฉาย ภูรินท์ชินธนโชติ, ธนโชติ ไชยหงษ์, อรรถพร เกษแก้ว, อัครวัฒน์
  ลี้วัฒธนพงษ์ — same treatment as DEV's fixed leads on F32. AS400/PMO/PM/Infra
  names (unmodeled departments) are plain static text labels, same as F32's
  existing unlinked names. Also fixed two bugs surfaced along the way:
  `F24-D6` was seeded as an orphaned seat (no `team_seats` row, not fixed
  either — silently rendered as an open bookable seat) and is now correctly
  fixed to อรรถพร; `F24-G4` had a pre-existing duplicate `team_seats` row
  assigning it to *both* SA and Scrum (removed the erroneous Scrum one — the
  sheet colors all of row G as SA). The one-off migration script used
  (`scripts/redraw-floor24.ts`) was deleted after running against the live DB,
  same as past one-off fixes in this file.
- **(2026-08-03) Floor grid spacing tweak**: F24's `grid_row`/`grid_col` were
  fully dense (no gaps anywhere), so the standalone corridor desks sat flush
  against the main seat grid and the A/B, C/D, E/F, G/H, I/J row-pairs had no
  visual aisle between them — added a 1-cell gap at both (corridor column is
  now `-1`, one row-number gap between each row-pair). F32 went the other way:
  its `grid_row` used the raw Excel row numbers directly, so gaps up to 4 rows
  wide (locker/meeting-room/aisle sections) made the floor feel very spread
  out — capped every gap at 2 to pull it closer together (single-row gaps
  untouched). Both are pure `grid_row`/`grid_col` renumbers — no seats added,
  removed, or reassigned. One-off script deleted after running.
- **(2026-08-06) Management desks on the floor map (`seats.rank`)**: fixed-name
  desks belonging to management now render as their own slate card with a brass
  nameplate instead of the plain amber fixed-desk card. `rank` has two values:
  `executive_office` = walled private room, drawn with a gold frame (พี่บังอร on
  F24, ปรีชาชาญ (ป้อง) on F24, เฉลิมพงษ์ (ปุ๊) on F32) and `executive` = management
  desk out on the floor, one flat style (กิตติพงษ์ (ตี๋) + สุลัดดา (อ้อ) on F5;
  ศรินญา (นุ่น), สมชาย (โตน), รสรินทร์ (เชอรี่) on F24; นุสรา (นก), วโรฒน์ (แบงค์),
  ทัศนกมล (โบ), วีรพงศ์ (กร) on F32). The cards show **names only** by request.
  The real org hierarchy behind them is intentionally *not* in the DB, since
  nothing displays it — recorded here instead so it isn't lost: พี่บังอร is the
  most senior, เฉลิมพงษ์ (ปุ๊) is second; ผอ. = กิตติพงษ์, ศรินญา, สมชาย, ปรีชาชาญ;
  รองผอ. = สุลัดดา, รสรินทร์, นุสรา, วโรฒน์, ทัศนกมล, วีรพงศ์. If tier labels are
  ever wanted on the map, that list is the source to re-derive them from.
  Floor 32's ten locker placards were also deleted in the same pass (unused —
  no `team_seats`/`bookings` referenced them).
