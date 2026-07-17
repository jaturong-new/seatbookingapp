# Follow-ups / known loose ends (2026-07-17)

Working notes from importing Floor 32 and the DEV attendance schedule from
`Mobile Office 2025-V3.xlsx` (in `~/Downloads`, not checked into this repo).
Read this before touching `data/dev_attendance.json`, F32 seat data, or the
`/team/[teamId]/schedule` page.

## Open questions

- **"บดินทร์" name mismatch.** The Booking Seat sheet has `บดินทร์ อิทธิพลชยานันท์`
  rotating through F5/F32 seats across many rounds. Our employees table instead
  has `บดินทร์ รินเย็น`, who never appears in any of the 42 real rounds. Unclear
  if this is the same person with the wrong surname in our DB, or two different
  people and the sheet's person just isn't in our system at all. Needs a human
  to confirm against HR records before renaming/adding anyone.

- **5 employees with zero coverage in the 42 real rounds**: ดรุฑ จงบรรเจิดเพชร,
  พีรพัฒน์ กิจพร้อมผล, คมชาญ จันทร์นาค, โอภาส ตรีนัย, บดินทร์ รินเย็น (see above).
  They currently fall back to the synthetic group-rotation calc (`isGroupWfh`)
  for WFH status on the schedule page, since the real sheet never scheduled them
  a seat in any of the 42 rounds. Confirm whether they're legitimately extra/new
  hires beyond the historical roster, or a data problem.

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
