import fs from "fs";
import path from "path";
import { getDb } from "./db";
import { computeAutoOccupants, computeAutoSeat, isGroupWfh } from "./rotation";

type AttendanceRound = { round: number; week_start: string; names: string[] };

let attendanceCache: { byWeek: Map<string, Set<string>>; knownNames: Set<string> } | null = null;

/** Real per-week attendance for DEV, sourced from the "Booking Seat" sheet (round 1 = 2026-08-03).
 * Falls back to the synthetic group rotation for weeks/employees outside this sheet's coverage
 * (e.g. someone the sheet never scheduled a seat for at all — not a real "always WFH" signal). */
function getRealAttendance() {
  if (attendanceCache) return attendanceCache;
  const filePath = path.join(process.cwd(), "data", "dev_attendance.json");
  const rounds: AttendanceRound[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const byWeek = new Map(rounds.map((r) => [r.week_start, new Set(r.names)]));
  const knownNames = new Set(rounds.flatMap((r) => r.names));
  attendanceCache = { byWeek, knownNames };
  return attendanceCache;
}

type SeatRound = { week_start: string; assignments: Record<string, string> };

let seatRoundsCache:
  | { weeks: Set<string>; seatCodes: Set<string>; byWeek: Map<string, Map<string, string>>; reverseByWeek: Map<string, Map<string, string>> }
  | null = null;

/** Real per-person, per-week desk assignment for DEV's rotating pool, sourced from the
 * "รอบที่นั่ง DEV" sheet (2026-07-23 import, 22 rounds covering 2026-08-03 – 2026-12-28).
 * This is the *only* place these ~25 F5 desks are assigned to real people; outside its
 * coverage (employee not in the sheet, or week beyond round 22) callers must fall back to
 * the synthetic `computeAutoSeat`/`computeAutoOccupants` rotation. */
function getRealSeatRounds() {
  if (seatRoundsCache) return seatRoundsCache;
  const filePath = path.join(process.cwd(), "data", "dev_seat_rounds.json");
  const data: { rounds: SeatRound[] } = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const weeks = new Set<string>();
  const seatCodes = new Set<string>();
  const byWeek = new Map<string, Map<string, string>>();
  const reverseByWeek = new Map<string, Map<string, string>>();

  for (const round of data.rounds) {
    weeks.add(round.week_start);
    const forward = new Map(Object.entries(round.assignments));
    byWeek.set(round.week_start, forward);
    const reverse = new Map<string, string>();
    for (const [name, code] of forward) {
      if (code === "WFH") continue;
      seatCodes.add(code);
      reverse.set(code, name);
    }
    reverseByWeek.set(round.week_start, reverse);
  }

  seatRoundsCache = { weeks, seatCodes, byWeek, reverseByWeek };
  return seatRoundsCache;
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
export type Seat = {
  id: number;
  floor_id: number;
  row_letter: string;
  col_number: number;
  code: string;
  full_code: string;
  grid_row: number;
  grid_col: number;
};
export type Team = { id: number; name: string };
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
export function getUnclaimedEmployees(): (Employee & { team_name: string })[] {
  return getDb()
    .prepare(
      `SELECT e.*, t.name as team_name FROM employees e JOIN teams t ON t.id = e.team_id
       WHERE e.active = 1 AND e.email IS NULL
         AND NOT EXISTS (SELECT 1 FROM seats s WHERE s.code = e.name)
       ORDER BY e.name`
    )
    .all() as (Employee & { team_name: string })[];
}

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

export function getEmployeeById(id: number): (Employee & { team_name: string }) | undefined {
  return getDb()
    .prepare(
      `SELECT e.*, t.name as team_name FROM employees e JOIN teams t ON t.id = e.team_id WHERE e.id = ?`
    )
    .get(id) as (Employee & { team_name: string }) | undefined;
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
  employee: (Employee & { team_name: string }) | null;
  source: "booked" | "auto" | "open" | "fixed";
  autoEmployee?: (Employee & { team_name: string }) | null;
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
  
  const inPool = getDb().prepare(`SELECT 1 FROM team_seats WHERE seat_id = ? LIMIT 1`).get(seat.id);
  if (!inPool) {
    const isSeatCode = /^[A-Za-z]+\d+$/.test(seat.code) || /^[Ff]\d+-[A-Za-z]+\d+$/.test(seat.code);
    if (!isSeatCode) {
      return { seat, employee: null, source: "fixed", autoEmployee };
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

  // If the employee has a fixed seat (their name is stored in seat.code)
  const fixed = db.prepare(`SELECT * FROM seats WHERE code = ?`).get(employee.name) as Seat | undefined;
  if (fixed) return { ...fixed, source: "fixed" };

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
 * Which weeks each rotating team member is in-office vs WFH, for a given list of weeks.
 * Excludes fixed-seat leads — they always attend, nothing to plan around. Uses the real
 * "Booking Seat" round data where available (source of truth); falls back to the synthetic
 * group rotation for weeks/employees that sheet doesn't cover.
 */
export function getTeamScheduleView(teamId: number, weekStarts: string[]): ScheduleRow[] {
  const roster = getDb()
    .prepare(
      `SELECT * FROM employees
       WHERE team_id = ? AND active = 1
         AND NOT EXISTS (SELECT 1 FROM seats s WHERE s.code = employees.name)
       ORDER BY name`
    )
    .all(teamId) as Employee[];

  const { byWeek, knownNames } = getRealAttendance();

  return roster.map((employee) => {
    const hasRealData = knownNames.has(employee.name);
    return {
      employee,
      weeks: weekStarts.map((weekStart) => {
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
