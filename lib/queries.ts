import { getDb } from "./db";
import { computeAutoOccupants, computeAutoSeat, isGroupWfh } from "./rotation";

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

export function getTeams(): Team[] {
  return getDb().prepare(`SELECT * FROM teams ORDER BY name`).all() as Team[];
}

export function getTeamByName(name: string): Team | undefined {
  return getDb().prepare(`SELECT * FROM teams WHERE name = ?`).get(name) as Team | undefined;
}

export function getEmployees(): (Employee & { team_name: string })[] {
  return getDb()
    .prepare(
      `SELECT e.*, t.name as team_name FROM employees e JOIN teams t ON t.id = e.team_id
       WHERE e.active = 1 ORDER BY e.name`
    )
    .all() as (Employee & { team_name: string })[];
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
  const occupants = computeAutoOccupants(seat.id, weekStart);
  const autoEmployee = occupants.length > 0 ? (getEmployeeById(occupants[0].id) ?? null) : null;

  if (booking?.status === "booked" && booking.employee_id != null) {
    const employee = getEmployeeById(booking.employee_id);
    return { seat, employee: employee ?? null, source: "booked", autoEmployee };
  }
  if (booking?.status === "released") {
    return { seat, employee: null, source: "open", autoEmployee };
  }
  if (occupants.length > 0) {
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

function getFiveWeeks(weekStart: string): string[] {
  const dates: string[] = [];
  const [year, month, day] = weekStart.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  for (let i = 0; i < 5; i++) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    date.setDate(date.getDate() + 7);
  }
  return dates;
}

export function bookSeat(seatId: number, weekStart: string, employeeId: number): BookResult {
  const db = getDb();
  const seat = db.prepare(`SELECT * FROM seats WHERE id = ?`).get(seatId) as Seat | undefined;
  const employee = getEmployeeById(employeeId);
  if (!seat || !employee) return { ok: false, error: "not_found" };

  const weeks = getFiveWeeks(weekStart);

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

export function getAllEmployeesIncludingInactive(): (Employee & { team_name: string })[] {
  return getDb()
    .prepare(
      `SELECT e.*, t.name as team_name FROM employees e JOIN teams t ON t.id = e.team_id ORDER BY t.name, e.name`
    )
    .all() as (Employee & { team_name: string })[];
}
