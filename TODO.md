# TODO — รายการที่ต้องแก้ (ตั้งไว้ 2026-08-06)

ที่มา: รีวิวโค้ด + data integrity sweep หลัง commit `a862ee3`
ทุกข้อในหมวด 🔴 🟠 🟡 **ยืนยันด้วยการรันจริงกับ DB ปัจจุบันแล้ว** ไม่ใช่การเดา
สถานะระบบตอนนี้: `AUTH_ENABLED=true`, `BOOKING_ENABLED=false`

---

## ✅ A. `/api/my-seat` + `/api/wfh-window` รั่วข้อมูลพนักงานทั้งบริษัท (IDOR) — แก้แล้ว 2026-08-07

> **สรุปที่แก้**
> - เพิ่ม `resolveRequestedEmployeeId()` ใน `lib/auth.ts` — โหมด auth ยึด identity จาก session เท่านั้น
>   `employeeId` จาก query string ใช้แค่ "เทียบว่าตรงกับตัวเองไหม" ไม่ได้ใช้เป็น key ค้นหา
> - `/api/my-seat` ส่งเฉพาะ `{id, name, team_name}` ไม่ส่ง employee row ดิบที่มี `email` ติดไป
> - **โบนัส**: `/admin007` เดิม fail-open (ถ้าไม่ตั้ง `ADMIN_EMAILS` = เปิดให้ทุกคนที่ login)
>   เปลี่ยนเป็น fail-closed แล้ว — หน้านี้เห็น email พนักงานทุกคน + แก้ mapping ได้
>
> **ผลทดสอบจริง** (session ปลอมที่ mint จาก NEXTAUTH_SECRET, server บน :3100)
> ```
> my-seat  own id    -> 200  ไม่มี email ใน payload
> my-seat  OTHER id  -> 403 forbidden
> my-seat  no id     -> 200  (ตกไปใช้ session)
> wfh-win  own id    -> 200
> wfh-win  OTHER id  -> 403 forbidden
> ```
> `tsc --noEmit` ผ่าน · DB กลับสู่สถานะเดิม (ยืนยัน content ตรงกับ HEAD)

<details>
<summary>รายละเอียดปัญหาเดิม</summary>

`app/api/my-seat/route.ts:12` · `app/api/wfh-window/route.ts:12`

รับ `employeeId` จาก query string แล้วเช็คแค่ `hasReadAccess()` (แค่ login แล้วผ่าน)
ไม่ได้เช็คว่า `employeeId` นั้นเป็นของคนที่ login อยู่จริง → ไล่เลข 1,2,3... ดึงข้อมูลคนอื่นได้ทั้งหมด

`getEmployeeById()` (`lib/queries.ts:293`) ใช้ `SELECT e.*` จึงพ่วง column `email` ออกไปด้วย
ยืนยันแล้ว payload มี:
```
id, name, team_id, active, group_number, email, team_name, team_color
```

> ⚠️ นี่คือช่องเดียวกับ pentest **FIND-01** ที่ปิด `/api/employees` ไปแล้ว แต่ 2 ตัวนี้ตกหล่น

**แนวทางแก้**
- ให้ 2 endpoint นี้ยึด identity จาก session เป็นหลัก (เหมือน `/api/bookings` ทำ) ไม่รับ `employeeId` จาก client
  หรือถ้ายังต้องรับ ให้เช็คว่าตรงกับ employee ของ session เท่านั้น
- อย่าส่ง `employee` object ดิบออกไป — เลือกเฉพาะ field ที่ UI ใช้ (`id`, `name`, `team_name`) ตัด `email` ออก
- เช็ค endpoint อื่นที่ใช้ `getEmployeeById` แล้วส่งออก response ด้วย

</details>

---

## 🟠 B + C. coverage ของข้อมูลจริงถูกรวมเป็นชุดเดียว (root cause เดียวกัน แก้ที่เดียว)

**เริ่มพังจริง 2027-01-04** (ยังไม่กระทบผู้ใช้วันนี้ แต่ต้องแก้ก่อนถึงเวลานั้น)

ต้นเหตุ: `getRealSeatRounds()` (`lib/queries.ts:101`) ยุบ `weeks` / `seatCodes` ของทุกไฟล์ทีมเป็น `Set` เดียว
และ `getRealAttendance()` (`lib/queries.ts:35`) ยุบ `byWeek` เหมือนกัน
แต่แต่ละไฟล์ข้อมูลจบไม่พร้อมกัน:

| ไฟล์ | ข้อมูลจบ |
|---|---|
| `dev_seat_rounds.json` | 2026-12-28 |
| `scrum_seat_rounds.json` | 2026-12-28 |
| `sa_seat_rounds.json` | 2027-01-11 |
| `nok_seat_rounds.json` | 2027-01-25 |
| `tester_seat_rounds.json` | 2027-02-08 |
| `dev_attendance.json` | 2027-05-17 |
| `scrum_attendance.json` | 2026-12-28 |

พอสัปดาห์หนึ่งอยู่ใน union แต่ไม่อยู่ในไฟล์ของทีมนั้น โค้ด 2 ฝั่งตีความต่างกัน

### B. โต๊ะโชว์ "ว่าง จองได้" ทั้งที่มีคนถืออยู่
`getRealSeatForEmployeeWeek` (`:149`) คืน `undefined` → ตกไปใช้ `computeAutoSeat` → คนได้โต๊ะ
แต่ `getRealOccupantId` (`:157`) คืน `null` = "ว่างจริง" → `getSeatAssignment` ตีเป็น `source: "open"`

ทดสอบสัปดาห์ **2027-01-18** (มีแต่ tester/นก ครอบคลุม): **13 จาก 32 คนของ SA** เจอปัญหา
```
ณฐพงศ์ เชี่ยวชูพันธ์  -> My Seat: F24-G3 (auto)  แต่ผัง: OPEN/จองได้
นภัสนันท์ สุราฤทธิ์  -> My Seat: F24-D5 (auto)  แต่ผัง: OPEN/จองได้
ธิดารัตน์ พิชิตการค้า -> My Seat: F32-L2 (auto)  แต่ผัง: OPEN/จองได้
```
สัปดาห์ที่กระทบ 2027-01-04 … 2027-02-08 · ที่ 2027-01-04 โต๊ะพูล DEV **พลิกเป็น open ทั้ง 25 ตัวพร้อมกัน**

### C. ทีม Scrum ขึ้น WFH ยกทีมตลอดกาล
`getTeamScheduleView` (`:650`, `:669`) อ่าน `knownNames` / `byWeek` ที่รวมไฟล์แล้ว
พอถึง 2027-01-04 → `byWeek.get(week)` ไม่ว่าง (มีชื่อ DEV) และ `hasRealData` เป็น true สำหรับคน Scrum
→ `!attendingThisWeek.has(name)` เป็น true ทุกคน → WFH หมด (ไม่มีโอกาสตกไปที่ `isGroupWfh`)

ยืนยันแล้ว:
```
2026-12-21: เข้า  9/24   <- ปกติ
2027-01-04: เข้า  0/24   <- ผิด
2027-03-01: เข้า  0/24   <- ผิด
```

**แนวทางแก้ (ทั้ง B และ C)**
เก็บ coverage แยกต่อไฟล์/ต่อทีม แทนที่จะ union — เช่น เก็บ `Map<fileName, {weeks, seatCodes, byWeek, reverseByWeek}>`
หรือเก็บช่วง `minWeek..maxWeek` ต่อไฟล์ แล้วให้ทั้ง 3 จุด (`getRealSeatForEmployeeWeek`,
`getRealOccupantId`, `getTeamScheduleView`) ตัดสินจาก coverage ของ *ทีมนั้น* เท่านั้น
เกณฑ์ที่ถูกต้องตาม `FOLLOWUPS.md` คือ "ทั้ง employee/seat **และ** สัปดาห์ ต้องอยู่ใน coverage ของไฟล์นั้น"

**ต้องเทสหลังแก้**: สัปดาห์ 2027-01-18 ต้องไม่มีเคส "My Seat มีโต๊ะ แต่ผังบอก open" และ Scrum ที่
2027-01-04 ต้องกลับไปใช้ `isGroupWfh` (เข้า ~5 ใน 6 สัปดาห์) ไม่ใช่ WFH ยกทีม

---

## 🟡 ต้องแก้ก่อนเปิด `BOOKING_ENABLED=true`

ตอนนี้ยังไม่ถูก exploit เพราะระบบจองปิดอยู่ (ยืนยันจาก pentest: prod คืน `503 booking_disabled`)

### D. `bookSeat()` ไม่เช็คคนที่ถือโต๊ะแบบ auto/ข้อมูลจริง → แย่งโต๊ะคนอื่นได้
`lib/queries.ts:505` (เช็คที่ `:523-532`) ดูแค่แถวใน `bookings` ที่ `status='booked'`
ไม่เรียก `getRealOccupantId` / `computeAutoOccupants` เลย
→ `POST /api/bookings {action:"book", seatId: <โต๊ะที่ source=auto ของคนอื่น>}` สำเร็จ
→ เจ้าของเดิม `getEmployeeWeekSeat` คืน `null` เสียโต๊ะเงียบๆ ไม่มีแจ้งเตือนที่ไหน
กันไว้แค่ฝั่ง client (`components/FloorMap.tsx` — `canBook` เช็ค `!selected.employee`)

### E. ไม่ validate `weekStart` เลย
`app/api/bookings/route.ts:33` และ `:77` เช็คแค่ว่ามีค่า (truthy)
- `weekStart: "not-a-date"` → `getConsecutiveWeeks` (`lib/queries.ts:490`) ผลิต `"NaN-NaN-NaN"` แล้ว insert เป็นแถวจริง
- `weekStart: "2026-08-04"` (วันอังคาร) รับตรงๆ → unique index (`lib/schema.sql:87`) เทียบ string
  จึงยอมให้คนเดียวจอง `2026-08-03` **และ** `2026-08-04` = 2 โต๊ะในสัปดาห์จริงเดียวกัน
- สัปดาห์ก่อน `FIRST_BOOKABLE_WEEK` ก็รับ (มีแต่ UI ที่ clamp ด้วย `clampToFirstWeek`)

**แก้**: validate รูปแบบ `YYYY-MM-DD` + ต้องเป็นวันจันทร์ (normalize ด้วย `weekStartOf`) + ไม่ก่อน `FIRST_BOOKABLE_WEEK` ฝั่ง server

### F. check-then-write อยู่นอก transaction
`lib/queries.ts:523-532` อ่าน แล้ว `:534` เพิ่งเปิด transaction เขียน
และ insert ใช้ `ON CONFLICT DO UPDATE SET employee_id = excluded.employee_id` → ถ้าแพ้เช็ค `seat_taken`
เฉียดฉิว ก็ยังเขียนทับของเดิมแทนที่จะ fail
ปลอดภัยตอนนี้เพราะ better-sqlite3 เป็น synchronous + `docker-compose.yml` ตรึง `replicas: 1`
**แก้**: ย้ายการเช็คเข้าไปใน transaction

### G. legacy branch ไม่เช็คเจ้าของ
`app/api/bookings/route.ts:88-89` เรียก `releaseSeat` / `clearOverride` ตรงๆ โดยไม่เช็คสิทธิ์
และไม่มี `getSeatById` guard (ต่างจาก auth branch ที่เช็คครบ `:42-63`)
`releaseSeat` (`lib/queries.ts:561`) / `clearOverride` (`:572`) เองก็ไม่ validate อะไรเลย
(กระทบเฉพาะโหมด `AUTH_ENABLED=false` ซึ่ง prod ไม่ได้ใช้)

---

## 🔵 คุณภาพ / ความถูกต้องระยะยาว

### H. `addEmployee` แจกกลุ่ม `% 4` แต่ระบบหมุน 6 กลุ่ม
`lib/queries.ts:603` → `const groupNumber = (count % 4) + 1;`
แต่ `wfhGroupForWeek` (`lib/rotation.ts:45`) คืน 1-6 และ `lib/seed.ts:87` ใช้ `% 6`
→ คนที่เพิ่มผ่านหน้า admin ตกอยู่กลุ่ม 1-4 เท่านั้น ทำให้รอบ WFH เบ้
สภาพจริงตอนนี้: `{1:28, 2:29, 3:28, 4:29, 5:24, 6:23}`
ปัญหาแฝง: `COUNT(*)` ที่ `:600` นับ inactive ด้วย (8 แถว) round-robin จึงเคลื่อน

### I. "การหมุนเวียน" ไม่หมุนจริง
`lib/rotation.ts:119` → `index = (initial_pool_index % pool.length + pool.length) % pool.length`
ไม่มี week offset เลย `computeAutoSeat` จึงให้ผลเท่าเดิมทุกสัปดาห์ (ยกเว้นเช็ค WFH ที่ `:108`)
→ fallback ที่ใช้หลังข้อมูลจริงหมด เป็นภาพนิ่ง ไม่ใช่การหมุนเวียน
และ `employee_rotation.seed_week_start` (`lib/schema.sql:70`) **ไม่มีโค้ดไหนอ่าน** ทั้งที่ comment
บอกว่าเป็นจุดตั้งต้นการหมุน — ต้องตัดสินใจว่าจะทำให้หมุนจริง หรือลบ column + แก้ comment

### J. ชื่อพนักงานซ้ำ + lookup ด้วยชื่อ
`employees.name` ไม่มี UNIQUE (`lib/schema.sql:43`) และมีซ้ำจริง 3 คู่
(`คมชาญ จันทร์นาค`, `พีรพัฒน์ กิจพร้อมผล`, `โอภาส ตรีนัย`) — ฝั่ง DEV `active=0` + ฝั่งพี่นก `active=1`
แต่ join ข้อมูลจริงทั้งหมดใช้ชื่อเป็น key: `getRealSeatForEmployeeWeek` (`:149`),
`getRealOccupantId` (`:157` ใช้ `.get()` เอาแถวแรก), `hasFixedSeat`, `getFixedLeadWfh`
→ ถ้า admin กด "เปิดใช้งาน" ฝั่ง DEV จะได้โต๊ะเดียวกัน 2 คน และผังแสดงคนไหนก็ขึ้นกับลำดับที่ SQLite คืน

> หมายเหตุ: การเช็ค integrity รอบก่อนไม่เจอ เพราะกรอง `active=1` ทั้งคู่จึงไม่ชน

### K. N+1 หนักตอนโหลดผัง
`computeAutoOccupants` (`lib/rotation.ts:125`) โหลดพนักงานที่มี rotation ทั้งหมด แล้วเรียก
`computeAutoSeat` ต่อคน ซึ่งแต่ละครั้ง query `initial_pool_index` + เรียก `getSeedWeekStart`
(`lib/rotation.ts:31`) ที่ query ตาราง `meta` ใหม่ทุกครั้งไม่ cache
`getSeatAssignment` เรียกมันต่อ **ทุกที่นั่ง** → วัดได้ ~3,000-8,500 queries ต่อการโหลดผัง 1 หน้า
(F32 ผ่าน real coverage ≈ 3,959 / นอก coverage ทั้ง 79 ที่นั่ง ≈ 8,500)
ผลลัพธ์ขึ้นกับ (employee, week) เท่านั้น จึงคำนวณซ้ำแบบเดิม ~90 ครั้ง
`teamHasDeterministicSeating` (`lib/queries.ts:110`) เพิ่มอีก 2 query ต่อที่นั่ง
**แก้**: cache ต่อ (week) หรือคำนวณ occupant map ครั้งเดียวใน `getFloorAssignments`

### L. จุดเปราะบางอื่น
- `getSeatAssignment` (`lib/queries.ts:352`) หยิบ `occupants[0]` ทิ้งที่เหลือ ทั้งที่
  `computeAutoOccupants` เขียน doc ว่าอาจได้ >1 ถ้าโต๊ะอยู่ 2 พูล — ตอนนี้ไม่มีเคสนั้น
  แต่ `FOLLOWUPS.md` บันทึกว่า `F24-G4` เคยซ้ำจริง → คนหายจากผังแบบไม่มีเตือน
- `fixed_wfh` merge ใช้ `.set()` ทับ (`lib/queries.ts:96`) ถ้า 2 ไฟล์มีชื่อเดียวกัน ไฟล์หลังชนะ
  สัปดาห์ WFH ของไฟล์แรกหาย (ตอนนี้มีแค่ `dev_seat_rounds.json` ที่มี `fixed_wfh`)
- `getEmployeeWeekSeat` (`lib/queries.ts:442-450`) มี `if (seat)` แต่ไม่มี `else` — ถ้า JSON อ้าง
  `full_code` ที่ไม่มีใน DB จะเงียบๆ ตกไป `computeAutoSeat` แล้วอาจไปนั่งโต๊ะของคนอื่น
  แทนที่จะฟ้องว่าข้อมูลผิด
- `rank` ยังไม่ authoritative: `bookSeat` (`:517`) และ `getSeatAssignment` (`:338`) ตัดสิน
  "จองได้ไหม" จาก regex รูปแบบชื่อ ไม่ได้ดู `seats.rank`
  ตอนนี้ปลอดภัย (ห้องผู้บริหารทั้ง 12 ใช้ชื่อไทย) แต่ถ้าใส่ rank ให้ที่นั่งที่ code เป็น `F32-P4`
  จะขึ้นเป็นห้องผู้บริหารบนผัง **แต่ยัง book ได้ผ่าน API** → เพิ่มเงื่อนไข `|| seat.rank` 2 จุด

### M. Bar seat ชั้น 5 กับ 32 พฤติกรรมต่างกัน
ของจริงเหมือนกันแต่ render ไม่เหมือน เพราะ regex เดารูปแบบชื่อ:
- ชั้น 5 `Bar Seat 1..4` (มีเว้นวรรค) → ไม่เข้า regex → ป้ายล็อค 🔒
- ชั้น 32 `Bar1..Bar4` (ไม่มีเว้นวรรค) → เข้า regex → "ว่าง จองได้" จองได้จริง

ต้องตัดสินใจว่าที่นั่งบาร์ควรจองได้หรือเป็นป้ายเฉยๆ แล้วทำให้ตรงกันทั้ง 2 ชั้น

### N. ลบของที่ไม่ได้ใช้
- `data/seed_v1.json` (72K) + `data/seed_v2.json` (20K) — ไม่มีไฟล์ไหนอ้างอิงเลย
- `app/api/claim/route.ts` + `claimEmployeeEmail` + `ClaimResult` (`lib/queries.ts:254-283`)
  เข้าไม่ถึงแล้ว: ไม่มี client เรียก `/api/claim`, UI เลือกชื่อถูกตัดออกไปแล้ว
  ตัวที่เขียน `employees.email` จริงเหลือแค่ admin `setEmployeeEmail`

### O. comment ใน `lib/schema.sql` ขัดกับโค้ด
- `:36-37` เขียนว่า "group_number (1-4) … 3 จาก 4 กลุ่มเข้าออฟฟิศ … ดู `week_group_is_wfh`"
  ของจริง: `CHECK (group_number BETWEEN 1 AND 6)` (`:48`), ฟังก์ชันชื่อ `wfhGroupForWeek`, และเป็น 5 จาก 6
  comment ยังบอกว่ากลุ่มเป็น round-robin สังเคราะห์ แต่ `FOLLOWUPS.md:73-78` บอกว่า DEV ถูกทับด้วยค่าจริงจาก sheet
- `:64-66` อธิบาย `seed_week_start` ว่าเป็นจุดตั้งต้นการหมุน — ไม่มีโค้ดอ่าน (ดูข้อ I)

---

## 📋 การตัดสินใจที่ต้องรอเจ้าของงาน (ไม่ใช่บั๊กโค้ด)

### P1. `data/seed.json` ล้าสมัยหนัก
| | seed.json | DB จริง |
|---|---|---|
| teams | 1 (DEV) | 5 |
| floors | 2 (F5, F32) | 3 (+F24) |
| employees | 54 | 161 |
| team_seats | 25 | 96 |

ไม่รู้จัก `seats.rank` ด้วย → `npm run seed` บน DB เปล่าจะสร้างออฟฟิศเวอร์ชันเก่ามาก
ทางกู้คืนจริงตอนนี้คือ `seatbooking.db` ที่ commit ไว้ (Docker bundle ตัวนี้) จึงไม่ได้อยู่บน critical path
**เลือก**: (ก) regenerate `seed.json` จาก DB จริง ให้ `npm run seed` ใช้งานได้อีก
หรือ (ข) ลบ `lib/seed.ts` + `data/seed.json` แล้วระบุชัดว่า DB ที่ commit เป็น source of truth

### P2. Scrum ขาดโต๊ะบนชั้น 32 — 52 person-weeks
sheet ส่งคนไป FL32 สัปดาห์ละ 8-10 คน แต่พูล Scrum บนชั้น 32 มี 7 โต๊ะ
2 โต๊ะที่ขาดคือ **F32-A1 / F32-A2** ซึ่งข้อมูลต้นทางขัดกันเอง:
- `Booking Seat` คอลัมน์ S-X → ยกให้ Scrum
- `Booking Seat` คอลัมน์ Y-AK → ยกให้ทีมพี่นก

ตอนนี้ยกให้พี่นก เพราะข้อมูลรายสัปดาห์จริงของพี่นกใช้ 2 โต๊ะนี้จริง (6 คนต่อโต๊ะ)
ผลคือคน Scrum 16 คนสลับกันไม่มีโต๊ะเจาะจง คนละ 2-6 สัปดาห์ (หน้าตารางเข้ายังขึ้น "เข้า" ถูกต้อง)
**ต้องถามฝ่ายจัดที่นั่งว่า 2 โต๊ะนี้เป็นของทีมไหน**

---

## ✅ ตรวจแล้วไม่มีปัญหา (ไม่ต้องทำ)

- **Data integrity 10 จุด ผ่านหมด**: ไม่มีชื่อซ้ำใน active, ไม่มีโต๊ะอยู่ 2 ทีม, ไม่มี `team_seats` ซ้ำ,
  ไม่มีโต๊ะเป็นทั้ง fixed+pool, ไม่มี FK กำพร้า, ไม่มี `full_code` ซ้ำ, ไม่มี grid ทับกัน,
  `group_number` อยู่ในช่วง 1-6, ไม่มี rank บนที่นั่งที่อยู่ในพูล
- **cache ไม่ค้างหลังแก้ผ่าน admin**: `poolCache` ผูก `team_seats` ที่ไม่มี admin action ไหนเขียน,
  `seatRoundsCache`/`attendanceCache` มาจาก JSON อ่านอย่างเดียว, ทุกหน้าที่โชว์ roster เป็น
  `force-dynamic` หรืออ่าน `searchParams`, `docker-compose.yml` ตรึง `replicas: 1` ถูกต้องแล้ว
- `bookSeat` กันการจองที่นั่งประจำ / ห้องผู้บริหารได้ถูกต้อง (`lib/queries.ts:515-521`)
- `npm audit`: postcss 2 high — เป็นช่องโหว่ตอน build (ประมวลผล CSS) ไม่ใช่ runtime
  และ fix ต้องอัพ Next 16 (breaking) → **แนะนำไม่ต้องทำ**

---

## ลำดับที่แนะนำ

1. ~~**A** — security รั่วอยู่ตอนนี้ ทำก่อน~~ ✅ เสร็จ 2026-08-07
2. **B + C** — แก้ที่เดียว (coverage แยกต่อไฟล์) ปลดล็อก 2 บั๊ก HIGH
3. **E → D → F → G** — ก่อนเปิด `BOOKING_ENABLED=true`
4. **H, K** — แก้ง่าย ผลชัด (`% 4`→`% 6` + cache)
5. **N, O, L(rank)** — เก็บกวาด ความเสี่ยงต่ำ
6. **I, J, M** — ต้องออกแบบ/ตัดสินใจก่อน
7. **P1, P2** — รอคำตอบเจ้าของงาน

> เตือนความจำ: ทุกครั้งที่แก้ `seatbooking.db` ต้อง `PRAGMA wal_checkpoint(TRUNCATE)` ก่อน commit
> ไม่งั้นข้อมูลจะค้างใน `-wal` ที่ถูก gitignore แล้ว commit ไปเป็นไฟล์เก่า (เคยพลาดมาแล้ว)
> และแก้ไฟล์ใน `data/*.json` ต้อง restart dev server (cache อ่านครั้งเดียวตอน process เริ่ม)
