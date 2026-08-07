import fs from "fs";
import path from "path";
import { getDb } from "./db";
import { computeAutoOccupants, computeAutoSeat, isGroupWfh } from "./rotation";

type AttendanceRound = { round: number; week_start: string; names: string[] };

let attendanceCache: { byWeek: Map<string, Set<string>>; knownNames: Set<string> } | null = null;

/** Real per-week attendance sources, one per team without per-desk rotation data (they only know
 * who's in vs. WFH that week, not which specific desk) — merged since a given week can come from either. */
const ATTENDANCE_FILES = ["dev_attendance.json", "scrum_attendance.json"];

/** Real per-week attendance, sourced from the "Booking Seat"/"Note.Scrum" sheets (round 1 =
 * 2026-08-03). Falls back to the synthetic group rotation for weeks/employees outside these
 * sheets' coverage (e.g. someone the sheet never scheduled a seat for at all — not a real
 * "always WFH" signal). */
function getRealAttendance() {
  if (attendanceCache) return attendanceCache;
  const byWeek = new Map<string, Set<string>>();
  const knownNames = new Set<string>();
  for (const fileName of ATTENDANCE_FILES) {
    const filePath = path.join(process.cwd(), "data", fileName);
    if (!fs.existsSync(filePath)) continue;
    const rounds: AttendanceRound[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    for (const round of rounds) {
      const names = byWeek.get(round.week_start) ?? new Set<string>();
      for (const name of round.names) {
        names.add(name);
        knownNames.add(name);
      }
      byWeek.set(round.week_start, names);
    }
  }
  attendanceCache = { byWeek, knownNames };
  return attendanceCache;
}

type SeatRound = { week_start: string; assignments: Record<string, string> };

let seatRoundsCache:
  | {
      weeks: Set<string>;
      seatCodes: Set<string>;
      byWeek: Map<string, Map<string, string>>;
      reverseByWeek: Map<string, Map<string, string>>;
      fixedWfh: Map<string, Set<string>>;
    }
  | null = null;

/** Real per-week desk-round sources, one per team's rotating pool, each sourced from the
 * "Mobile Office" sheet family (see each file's own `source` field for exact sheet/import date).
 * Merged together below since a given week_start/seat can come from any of them. */
const SEAT_ROUNDS_FILES = [
  "dev_seat_rounds.json",
  "nok_seat_rounds.json",
  "tester_seat_rounds.json",
  "sa_seat_rounds.json",
  "scrum_seat_rounds.json",
];

/** Real per-person, per-week desk assignment for each team's rotating pool. This is the *only*
 * place these desks are assigned to real people; outside its coverage (employee not in any
 * sheet, or week beyond that sheet's last round) callers must fall back to the synthetic
 * `computeAutoSeat`/`computeAutoOccupants` rotation. */
function getRealSeatRounds() {
  if (seatRoundsCache) return seatRoundsCache;

  const weeks = new Set<string>();
  const seatCodes = new Set<string>();
  const byWeek = new Map<string, Map<string, string>>();
  const reverseByWeek = new Map<string, Map<string, string>>();
  const fixedWfh = new Map<string, Set<string>>();

  for (const fileName of SEAT_ROUNDS_FILES) {
    const filePath = path.join(process.cwd(), "data", fileName);
    if (!fs.existsSync(filePath)) continue;
    const data: { rounds: SeatRound[]; fixed_wfh?: Record<string, string[]> } = JSON.parse(
      fs.readFileSync(filePath, "utf-8")
    );

    for (const round of data.rounds) {
      weeks.add(round.week_start);
      const forward = byWeek.get(round.week_start) ?? new Map<string, string>();
      const reverse = reverseByWeek.get(round.week_start) ?? new Map<string, string>();
      for (const [name, code] of Object.entries(round.assignments)) {
        forward.set(name, code);
        if (code === "WFH") continue;
        seatCodes.add(code);
        reverse.set(code, name);
      }
      byWeek.set(round.week_start, forward);
      reverseByWeek.set(round.week_start, reverse);
    }

    for (const [name, wfhWeeks] of Object.entries(data.fixed_wfh ?? {})) {
      fixedWfh.set(name, new Set(wfhWeeks));
    }
  }

  seatRoundsCache = { weeks, seatCodes, byWeek, reverseByWeek, fixedWfh };
  return seatRoundsCache;
}

/** Whether this team's pool can ever land a specific employee on a specific desk — either via the
 * real per-desk seat-round sheets, or via the synthetic rotation (employee_rotation rows). Teams
 * with neither (e.g. Scrum, whose source data only says which floor someone's on, not which desk)
 * can never resolve an occupant for their pool seats, so those seats must stay "reserved for the
 * team" rather than falling through to "open" just because nobody happens to be assigned this week. */
function teamHasDeterministicSeating(teamId: number): boolean {
  const hasRotation = getDb()
    .prepare(
      `SELECT 1 FROM employees e JOIN employee_rotation er ON er.employee_id = e.id WHERE e.team_id = ? LIMIT 1`
    )
    .get(teamId);
  if (hasRotation) return true;
  const poolSeats = getDb()
    .prepare(`SELECT s.full_code as fullCode FROM team_seats ts JOIN seats s ON s.id = ts.seat_id WHERE ts.team_id = ?`)
    .all(teamId) as { fullCode: string }[];
  const { seatCodes } = getRealSeatRounds();
  return poolSeats.some((s) => seatCodes.has(s.fullCode));
}

/** Whether a fixed-seat lead is WFH this week per the sheet's "กลุ่ม fix" rows, or undefined if
 * the sheet doesn't schedule this person (e.g. leads outside DEV's rotation — they always attend).
 * Their desk stays reserved either way: it's never in a team pool, so nobody takes it while they're out. */
function getFixedLeadWfh(employeeName: string, weekStart: string): boolean | undefined {
  const { fixedWfh } = getRealSeatRounds();
  const wfhWeeks = fixedWfh.get(employeeName);
  if (!wfhWeeks) return undefined;
  return wfhWeeks.has(weekStart);
}

/** Names of fixed-seat leads whose WFH rounds the sheet does schedule — they belong in the
 * attendance schedule alongside the rotating members, unlike leads who attend every week. */
function getScheduledFixedLeadNames(): Set<string> {
  return new Set(getRealSeatRounds().fixedWfh.keys());
}

/** Whether a permanent desk is reserved under this name (fixed seats store the employee's name in seat.code). */
function hasFixedSeat(employeeName: string): boolean {
  return (
    getDb().prepare(`SELECT 1 FROM seats WHERE code = ? LIMIT 1`).get(employeeName) !== undefined
  );
}

/** The employee's real assigned desk for this exact week, or "WFH", or undefined if this
 * employee/week falls outside the real sheet's coverage (caller should use the algorithm instead). */
function getRealSeatForEmployeeWeek(employeeName: string, weekStart: string): string | undefined {
  const real = getRealSeatRounds();
  if (!real.weeks.has(weekStart)) return undefined;
  return real.byWeek.get(weekStart)?.get(employeeName);
}

/** The real occupant's employee id for a seat this week: a number if assigned, null if the
 * seat/week is covered by the real sheet but genuinely open, or undefined if not covered at all. */
function getRealOccupantId(seat: Seat, weekStart: string): number | null | undefined {
  const real = getRealSeatRounds();
  if (!real.weeks.has(weekStart) || !real.seatCodes.has(seat.full_code)) return undefined;
  const name = real.reverseByWeek.get(weekStart)?.get(seat.full_code);
  if (!name) return null;
  const employee = getDb().prepare(`SELECT id FROM employees WHERE name = ? AND active = 1`).get(name) as
    | { id: number }
    | undefined;
  return employee ? employee.id : null;
}

export type Floor = { id: number; code: string; name: string };
/** Management desk marker, set only on fixed-name seats. "executive_office" is a walled private
 * room (framed on the floor map), "executive" a management desk out on the floor. */
export type SeatRank = "chief_office" | "executive_office" | "executive";

export type Seat = {
  id: number;
  floor_id: number;
  row_letter: string;
  col_number: number;
  code: string;
  full_code: string;
  grid_row: number;
  grid_col: number;
  rank: SeatRank | null;
};
export type Team = { id: number; name: string; color: string | null };
export type Employee = {
  id: number;
  name: string;
  team_id: number;
  active: number;
  group_number: number;
  email: string | null;
};

export function getFloors(): Floor[] {
  // sort by the numeric floor number in the code (e.g. "F24" -> 24), not alphabetically
  // ("F24" < "F32" < "F5" as strings, which is out of physical floor order)
  return getDb()
    .prepare(`SELECT * FROM floors ORDER BY CAST(SUBSTR(code, 2) AS INTEGER)`)
    .all() as Floor[];
}

export function getFloorByCode(code: string): Floor | undefined {
  return getDb().prepare(`SELECT * FROM floors WHERE code = ?`).get(code) as Floor | undefined;
}

export function getSeatsForFloor(floorId: number): Seat[] {
  return getDb()
    .prepare(`SELECT * FROM seats WHERE floor_id = ? ORDER BY grid_row, grid_col`)
    .all(floorId) as Seat[];
}

export function getSeatById(id: number): Seat | undefined {
  return getDb().prepare(`SELECT * FROM seats WHERE id = ?`).get(id) as Seat | undefined;
}

export function getTeams(): Team[] {
  return getDb().prepare(`SELECT * FROM teams ORDER BY name`).all() as Team[];
}

/** Teams with at least one employee -- excludes reservation-only teams (e.g. Scrum) that have
 * no roster yet, since their /team/:id and /team/:id/schedule pages would have nothing to show. */
export function getStaffedTeams(): Team[] {
  return getDb()
    .prepare(
      `SELECT * FROM teams WHERE id IN (SELECT DISTINCT team_id FROM employees) ORDER BY name`
    )
    .all() as Team[];
}

export function getTeamByName(name: string): Team | undefined {
  return getDb().prepare(`SELECT * FROM teams WHERE name = ?`).get(name) as Team | undefined;
}

/** Employees selectable for booking: excludes fixed-seat leads (they already have a permanent seat, nothing to book). */
export function getEmployees(): (Employee & { team_name: string })[] {
  return getDb()
    .prepare(
      `SELECT e.*, t.name as team_name FROM employees e JOIN teams t ON t.id = e.team_id
       WHERE e.active = 1 AND NOT EXISTS (SELECT 1 FROM seats s WHERE s.code = e.name)
       ORDER BY e.name`
    )
    .all() as (Employee & { team_name: string })[];
}

export function getEmployeeByEmail(email: string): (Employee & { team_name: string }) | undefined {
  return getDb()
    .prepare(
      `SELECT e.*, t.name as team_name FROM employees e JOIN teams t ON t.id = e.team_id
       WHERE lower(e.email) = lower(?)`
    )
    .get(email) as (Employee & { team_name: string }) | undefined;
}

/** Names still available to claim on first sign-in: active, no email bound yet, and not a fixed-seat lead. */
export type ClaimResult =
  | { ok: true }
  | { ok: false; error: "email_taken" | "name_taken" | "not_found" };

/** First-login claim: permanently bind a Google email to an unclaimed employee name. */
export function claimEmployeeEmail(employeeId: number, email: string): ClaimResult {
  const db = getDb();
  const normalized = email.toLowerCase();
  if (getEmployeeByEmail(normalized)) return { ok: false, error: "email_taken" };
  const target = db
    .prepare(
      `SELECT id, email FROM employees
       WHERE id = ? AND active = 1
         AND NOT EXISTS (SELECT 1 FROM seats s WHERE s.code = employees.name)`
    )
    .get(employeeId) as { id: number; email: string | null } | undefined;
  if (!target) return { ok: false, error: "not_found" };
  if (target.email) return { ok: false, error: "name_taken" };
  try {
    const info = db
      .prepare(`UPDATE employees SET email = ? WHERE id = ? AND email IS NULL`)
      .run(normalized, employeeId);
    if (info.changes !== 1) return { ok: false, error: "name_taken" };
    return { ok: true };
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return { ok: false, error: "email_taken" };
    throw err;
  }
}

/** The employees.name cleanup shared by both auto-claim matching and the manual claim picker:
 * strip a nickname in parens ("กิตติพงษ์ (ตี๋)" -> "กิตติพงษ์") and a team-code prefix some
 * fixed-seat rows carry ("SA : ณภัค" -> "ณภัค"). Matching is exact-after-cleanup only — no fuzzy
 * scoring here, unlike the one-off email-mapping script this replaces; ambiguity always falls
 * through to the manual picker rather than guessing. */
function cleanEmployeeName(raw: string): string {
  return raw
    .replace(/\s*\([^)]+\)/g, "")
    .replace(/^[A-Za-z0-9\s]+:\s*/, "")
    .trim();
}

/** Google Workspace display names here are consistently "English Name - ไทย ชื่อ" -- pull out
 * the Thai segment since employee records are always Thai names. Duplicated from the equivalent
 * client-side helper in PersonPicker.tsx (kept separate on purpose: that one is UI display
 * formatting, this one feeds an identity match and must stay auditable on its own). */
function extractThaiSegment(fullName: string): string {
  const parts = fullName.split(/\s*-\s*/);
  const thaiPart = parts.find((p) => /[฀-๿]/.test(p));
  return (thaiPart ?? fullName).trim();
}

/** Active, unclaimed, not a fixed-seat lead (mirrors claimEmployeeEmail's own eligibility check —
 * a fixed-seat row's `name` is a seat-code placeholder, not a real full name). The set either
 * auto-claim or the manual picker is allowed to bind. */
function getClaimableEmployeesRaw(): { id: number; name: string; team_name: string }[] {
  return getDb()
    .prepare(
      `SELECT e.id, e.name, t.name as team_name FROM employees e JOIN teams t ON t.id = e.team_id
       WHERE e.active = 1 AND e.email IS NULL
         AND NOT EXISTS (SELECT 1 FROM seats s WHERE s.code = e.name)
       ORDER BY e.name`
    )
    .all() as { id: number; name: string; team_name: string }[];
}

/** Names still open for the manual claim picker (fallback when auto-claim below can't resolve
 * someone) — no email in this payload, only names/teams, which the app already shows on every
 * team roster page to any signed-in user. */
export function getClaimableEmployees(): { id: number; name: string; team_name: string }[] {
  return getClaimableEmployeesRaw();
}

/** Best-effort, zero-guess auto-claim: on first sign-in, try to bind the Google account straight
 * to its employee row by matching the account's Thai display name against unclaimed employees,
 * exact after cleanup. Silent no-op on zero or multiple matches -- ambiguity (e.g. two people
 * with the same cleaned name) always falls through to the manual picker, never picks a guess. */
export function tryAutoClaimByName(
  email: string,
  googleName: string | null
): (Employee & { team_name: string }) | null {
  if (!googleName) return null;
  const target = cleanEmployeeName(extractThaiSegment(googleName));
  if (!target) return null;
  const matches = getClaimableEmployeesRaw().filter((c) => cleanEmployeeName(c.name) === target);
  if (matches.length !== 1) return null;
  const result = claimEmployeeEmail(matches[0].id, email);
  return result.ok ? getEmployeeByEmail(email) ?? null : null;
}

/** Admin: set or clear an employee's email binding directly (fix wrong claims). */
export function setEmployeeEmail(employeeId: number, email: string | null): ClaimResult {
  try {
    getDb()
      .prepare(`UPDATE employees SET email = ? WHERE id = ?`)
      .run(email ? email.toLowerCase() : null, employeeId);
    return { ok: true };
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return { ok: false, error: "email_taken" };
    throw err;
  }
}

export function getEmployeeById(
  id: number
): (Employee & { team_name: string; team_color: string | null }) | undefined {
  return getDb()
    .prepare(
      `SELECT e.*, t.name as team_name, t.color as team_color FROM employees e JOIN teams t ON t.id = e.team_id WHERE e.id = ?`
    )
    .get(id) as (Employee & { team_name: string; team_color: string | null }) | undefined;
}

export function getTeamRoster(teamId: number): Employee[] {
  return getDb()
    .prepare(`SELECT * FROM employees WHERE team_id = ? AND active = 1 ORDER BY name`)
    .all(teamId) as Employee[];
}

type BookingRow = {
  id: number;
  seat_id: number;
  week_start: string;
  employee_id: number | null;
  status: "booked" | "released";
};

export type SeatAssignment = {
  seat: Seat;
  employee: (Employee & { team_name: string; team_color: string | null }) | null;
  source: "booked" | "auto" | "open" | "fixed";
  autoEmployee?: (Employee & { team_name: string; team_color: string | null }) | null;
  /** Fixed seat whose owner is WFH this week — still reserved for them, just empty. */
  fixedWfh?: boolean;
  /** Team color for a fixed seat, resolved by matching seat.code to an employee name (if any). */
  fixedTeamColor?: string | null;
  /** Set when this "fixed" seat is really an unstaffed team-pool reservation (no roster yet) rather than a named owner's desk. */
  fixedTeamName?: string;
};

function getBookingFor(seatId: number, weekStart: string): BookingRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM bookings WHERE seat_id = ? AND week_start = ?`)
    .get(seatId, weekStart) as BookingRow | undefined;
}

/** Resolve who effectively occupies a seat for a given week: explicit booking wins, then auto-rotation, else open. */
export function getSeatAssignment(seat: Seat, weekStart: string): SeatAssignment {
  const booking = getBookingFor(seat.id, weekStart);
  const realOccupantId = getRealOccupantId(seat, weekStart);
  const autoEmployee =
    realOccupantId !== undefined
      ? realOccupantId != null
        ? getEmployeeById(realOccupantId) ?? null
        : null
      : (() => {
          const occupants = computeAutoOccupants(seat.id, weekStart);
          return occupants.length > 0 ? getEmployeeById(occupants[0].id) ?? null : null;
        })();

  if (booking?.status === "booked" && booking.employee_id != null) {
    const employee = getEmployeeById(booking.employee_id);
    return { seat, employee: employee ?? null, source: "booked", autoEmployee };
  }
  if (booking?.status === "released") {
    return { seat, employee: null, source: "open", autoEmployee };
  }
  if (autoEmployee) {
    return { seat, employee: autoEmployee, source: "auto", autoEmployee };
  }
  
  const inPool = getDb()
    .prepare(
      `SELECT t.id as team_id, t.name as team_name, t.color as team_color FROM team_seats ts
       JOIN teams t ON t.id = ts.team_id WHERE ts.seat_id = ? LIMIT 1`
    )
    .get(seat.id) as { team_id: number; team_name: string; team_color: string | null } | undefined;
  if (!inPool) {
    const isSeatCode = /^[A-Za-z]+\d+$/.test(seat.code) || /^[Ff]\d+-[A-Za-z]+\d+$/.test(seat.code);
    if (!isSeatCode) {
      // seat.code is the owner's name on a fixed seat — flag the weeks they're WFH so the map can
      // say "reserved, owner out" instead of implying they're at the desk.
      const fixedWfh = getFixedLeadWfh(seat.code, weekStart) === true;
      const owner = getDb()
        .prepare(`SELECT t.color as team_color FROM employees e JOIN teams t ON t.id = e.team_id WHERE e.name = ?`)
        .get(seat.code) as { team_color: string | null } | undefined;
      return { seat, employee: null, source: "fixed", autoEmployee, fixedWfh, fixedTeamColor: owner?.team_color ?? null };
    }
  } else {
    // A pool seat whose team has no roster, or whose roster has no way to ever land on a specific
    // desk (no per-desk rotation and never referenced by the real seat-round sheets — e.g. Scrum,
    // which only tracks who's in the building, not which of its desks they sit at) is never
    // actually "open" -- it's just unstaffed. Show it as reserved for that team, not bookable.
    const hasMembers = getDb().prepare(`SELECT 1 FROM employees WHERE team_id = ? LIMIT 1`).get(inPool.team_id);
    if (!hasMembers || !teamHasDeterministicSeating(inPool.team_id)) {
      return {
        seat,
        employee: null,
        source: "fixed",
        autoEmployee,
        fixedTeamColor: inPool.team_color,
        fixedTeamName: inPool.team_name,
      };
    }
  }

  return { seat, employee: null, source: "open", autoEmployee };
}

export function getFloorAssignments(floorId: number, weekStart: string): SeatAssignment[] {
  const seats = getSeatsForFloor(floorId);
  return seats.map((seat) => getSeatAssignment(seat, weekStart));
}

export type EmployeeWeekSeat =
  | (Seat & { source: "booked" | "auto" | "fixed" })
  | { source: "wfh" }
  | null;

/** The employee's own effective seat this week (booked, auto, or WFH if their group is off), if any. */
export function getEmployeeWeekSeat(employeeId: number, weekStart: string): EmployeeWeekSeat {
  const db = getDb();
  const booked = db
    .prepare(
      `SELECT s.* FROM bookings b JOIN seats s ON s.id = b.seat_id
       WHERE b.employee_id = ? AND b.week_start = ? AND b.status = 'booked'`
    )
    .get(employeeId, weekStart) as Seat | undefined;
  if (booked) return { ...booked, source: "booked" };

  const employee = getEmployeeById(employeeId);
  if (!employee) return null;

  // If the employee has a fixed seat (their name is stored in seat.code). A fixed seat isn't the
  // same as attending every week: the sheet's "กลุ่ม fix" leads still take WFH rounds, and their
  // desk simply sits empty (reserved) those weeks.
  const fixed = db.prepare(`SELECT * FROM seats WHERE code = ?`).get(employee.name) as Seat | undefined;
  if (fixed) {
    if (getFixedLeadWfh(employee.name, weekStart)) return { source: "wfh" };
    return { ...fixed, source: "fixed" };
  }

  // Real per-week desk data (รอบที่นั่ง DEV sheet) wins over the synthetic rotation when it
  // covers this employee/week; falls through to the algorithm otherwise.
  const realAssignment = getRealSeatForEmployeeWeek(employee.name, weekStart);
  if (realAssignment !== undefined) {
    if (realAssignment === "WFH") return { source: "wfh" };
    const seat = db.prepare(`SELECT * FROM seats WHERE full_code = ?`).get(realAssignment) as Seat | undefined;
    if (seat) {
      const booking = getBookingFor(seat.id, weekStart);
      if (booking && !(booking.status === "booked" && booking.employee_id === employeeId)) {
        return null;
      }
      return { ...seat, source: "auto" };
    }
  }

  if (isGroupWfh(employee.group_number, weekStart)) return { source: "wfh" };

  const auto = computeAutoSeat(
    { id: employee.id, team_id: employee.team_id, group_number: employee.group_number },
    weekStart
  );
  if (!auto) return null;
  // an auto seat only counts if it hasn't been released or booked by someone else that week
  const booking = getBookingFor(auto.seatId, weekStart);
  if (booking && !(booking.status === "booked" && booking.employee_id === employeeId)) {
    return null;
  }
  const seat = db.prepare(`SELECT * FROM seats WHERE id = ?`).get(auto.seatId) as Seat;
  return { ...seat, source: "auto" };
}

export type TeamWeekRow = {
  employee: Employee;
  seat: (Seat & { floor_code: string; source: "booked" | "auto" | "fixed" }) | { source: "wfh" } | null;
};

export function getTeamWeekView(teamId: number, weekStart: string): TeamWeekRow[] {
  const db = getDb();
  const roster = getTeamRoster(teamId);
  return roster.map((employee) => {
    const seat = getEmployeeWeekSeat(employee.id, weekStart);
    if (!seat || seat.source === "wfh") return { employee, seat };
    const floor = db.prepare(`SELECT code FROM floors WHERE id = ?`).get(seat.floor_id) as {
      code: string;
    };
    return { employee, seat: { ...seat, floor_code: floor.code } };
  });
}

export type BookResult =
  | { ok: true }
  | { ok: false; error: "seat_taken" | "already_booked" | "not_found" };

function getConsecutiveWeeks(weekStart: string, count: number): string[] {
  const dates: string[] = [];
  const [year, month, day] = weekStart.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  for (let i = 0; i < count; i++) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    date.setDate(date.getDate() + 7);
  }
  return dates;
}

/** `weekCount`: how many consecutive weeks (1-5) to book starting at `weekStart`, per employee request. */
export function bookSeat(seatId: number, weekStart: string, employeeId: number, weekCount: number): BookResult {
  const db = getDb();
  const seat = db.prepare(`SELECT * FROM seats WHERE id = ?`).get(seatId) as Seat | undefined;
  const employee = getEmployeeById(employeeId);
  if (!seat || !employee) return { ok: false, error: "not_found" };

  const clampedCount = Math.min(5, Math.max(1, Math.round(weekCount) || 1));
  const weeks = getConsecutiveWeeks(weekStart, clampedCount);

  // Check if it's a fixed seat
  const inPool = db.prepare(`SELECT 1 FROM team_seats WHERE seat_id = ? LIMIT 1`).get(seatId);
  if (!inPool) {
    const isSeatCode = /^[A-Za-z]+\d+$/.test(seat.code) || /^[Ff]\d+-[A-Za-z]+\d+$/.test(seat.code);
    if (!isSeatCode) {
      return { ok: false, error: "not_found" };
    }
  }

  // Check if explicitly booked by someone else in any of the 5 weeks
  const checkStmt = db.prepare(
    `SELECT employee_id FROM bookings WHERE seat_id = ? AND week_start = ? AND status = 'booked'`
  );
  for (const w of weeks) {
    const booked = checkStmt.get(seatId, w) as { employee_id: number } | undefined;
    if (booked && booked.employee_id !== employeeId) {
      return { ok: false, error: "seat_taken" };
    }
  }

  try {
    const runTx = db.transaction(() => {
      const deleteStmt = db.prepare(
        `DELETE FROM bookings WHERE employee_id = ? AND week_start = ? AND status = 'booked' AND seat_id != ?`
      );
      const insertStmt = db.prepare(
        `INSERT INTO bookings (seat_id, week_start, employee_id, status)
         VALUES (?, ?, ?, 'booked')
         ON CONFLICT(seat_id, week_start) DO UPDATE SET employee_id = excluded.employee_id, status = 'booked'`
      );

      for (const w of weeks) {
        deleteStmt.run(employeeId, w, seatId);
        insertStmt.run(seatId, w, employeeId);
      }
    });

    runTx();
    return { ok: true };
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE" && String(err.message).includes("employee_id")) {
      return { ok: false, error: "already_booked" };
    }
    throw err;
  }
}

export function releaseSeat(seatId: number, weekStart: string): BookResult {
  const db = getDb();
  db.prepare(
    `INSERT INTO bookings (seat_id, week_start, employee_id, status)
     VALUES (?, ?, NULL, 'released')
     ON CONFLICT(seat_id, week_start) DO UPDATE SET employee_id = NULL, status = 'released'`
  ).run(seatId, weekStart);
  return { ok: true };
}

/** Undo an explicit booking/release override, reverting the seat back to its auto-rotation state for that week. */
export function clearOverride(seatId: number, weekStart: string): BookResult {
  getDb().prepare(`DELETE FROM bookings WHERE seat_id = ? AND week_start = ?`).run(seatId, weekStart);
  return { ok: true };
}

export type OverrideRow = {
  id: number;
  seat_full_code: string;
  week_start: string;
  status: "booked" | "released";
  employee_name: string | null;
};

export function listOverridesForWeek(weekStart: string): OverrideRow[] {
  return getDb()
    .prepare(
      `SELECT b.id, s.full_code as seat_full_code, b.week_start, b.status, e.name as employee_name
       FROM bookings b
       JOIN seats s ON s.id = b.seat_id
       LEFT JOIN employees e ON e.id = b.employee_id
       WHERE b.week_start = ?
       ORDER BY s.full_code`
    )
    .all(weekStart) as OverrideRow[];
}

export function addEmployee(name: string, teamId: number): number {
  const db = getDb();
  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM employees WHERE team_id = ?`)
    .get(teamId) as { count: number };
  const groupNumber = (count % 4) + 1;
  const info = db
    .prepare(`INSERT INTO employees (name, team_id, group_number) VALUES (?, ?, ?)`)
    .run(name, teamId, groupNumber);
  return info.lastInsertRowid as number;
}

export function setEmployeeActive(employeeId: number, active: boolean): void {
  getDb().prepare(`UPDATE employees SET active = ? WHERE id = ?`).run(active ? 1 : 0, employeeId);
}

/** Employees manageable from admin: excludes fixed-seat leads (their seat is permanent, not part of the active/inactive rotation toggle). */
export function getAllEmployeesIncludingInactive(): (Employee & { team_name: string })[] {
  return getDb()
    .prepare(
      `SELECT e.*, t.name as team_name FROM employees e
       JOIN teams t ON t.id = e.team_id
       WHERE NOT EXISTS (SELECT 1 FROM seats s WHERE s.code = e.name)
       ORDER BY e.active DESC, t.name, e.name`
    )
    .all() as (Employee & { team_name: string })[];
}

export type ScheduleRow = {
  employee: Employee;
  weeks: { weekStart: string; wfh: boolean }[];
};

/**
 * Which weeks each team member is in-office vs WFH, for a given list of weeks. Covers the rotating
 * members plus the "กลุ่ม fix" leads the sheet schedules WFH rounds for; excludes leads with a fixed
 * seat and no scheduled rounds — they always attend, nothing to plan around. Uses the real
 * "Booking Seat" round data where available (source of truth); falls back to the synthetic
 * group rotation for weeks/employees that sheet doesn't cover.
 */
export function getTeamScheduleView(teamId: number, weekStarts: string[]): ScheduleRow[] {
  const scheduledLeads = getScheduledFixedLeadNames();
  const roster = (
    getDb()
      .prepare(
        `SELECT * FROM employees
       WHERE team_id = ? AND active = 1
       ORDER BY name`
      )
      .all(teamId) as Employee[]
  ).filter((e) => scheduledLeads.has(e.name) || !hasFixedSeat(e.name));

  const { byWeek, knownNames } = getRealAttendance();

  return roster.map((employee) => {
    const hasRealData = knownNames.has(employee.name);
    return {
      employee,
      weeks: weekStarts.map((weekStart) => {
        // A fixed-seat lead's own WFH rounds come from the sheet's "กลุ่ม fix" rows, not from the
        // rotating per-desk assignments (their desk never enters the pool).
        const leadWfh = getFixedLeadWfh(employee.name, weekStart);
        if (leadWfh !== undefined) {
          return { weekStart, wfh: leadWfh };
        }
        // รอบที่นั่ง DEV (dev_seat_rounds.json) is the newer, per-desk source of truth —
        // prefer it over the older dev_attendance.json whenever it covers this employee/week.
        const realSeat = getRealSeatForEmployeeWeek(employee.name, weekStart);
        if (realSeat !== undefined) {
          return { weekStart, wfh: realSeat === "WFH" };
        }
        const attendingThisWeek = hasRealData ? byWeek.get(weekStart) : undefined;
        const wfh = attendingThisWeek ? !attendingThisWeek.has(employee.name) : isGroupWfh(employee.group_number, weekStart);
        return { weekStart, wfh };
      }),
    };
  });
}
