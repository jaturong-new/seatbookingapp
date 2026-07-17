import { getDb } from "./db";

/** Monday of the ISO week containing `date`, formatted as YYYY-MM-DD. */
export function weekStartOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

export function addWeeks(weekStart: string, weeks: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function weekOffset(fromWeekStart: string, toWeekStart: string): number {
  const from = new Date(`${fromWeekStart}T00:00:00Z`).getTime();
  const to = new Date(`${toWeekStart}T00:00:00Z`).getTime();
  return Math.round((to - from) / (7 * 24 * 60 * 60 * 1000));
}

/** Booking opens for the week of 2026-08-03 onward; earlier weeks are not selectable in the UI. */
export const FIRST_BOOKABLE_WEEK = "2026-08-03";

export function clampToFirstWeek(weekStart: string): string {
  return weekStart < FIRST_BOOKABLE_WEEK ? FIRST_BOOKABLE_WEEK : weekStart;
}

export function getSeedWeekStart(): string {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'seed_week_start'`).get() as
    | { value: string }
    | undefined;
  return row?.value ?? weekStartOf(new Date());
}

/**
 * Real office policy: each team's roster is split into 6 even groups; every week 5 of the 6
 * groups are in-office and 1 is WFH, cycling so each person gets 1-in-6 weeks off
 * (office 5 weeks, WFH 1 week). The WFH group for a given week cycles 6 -> 1 -> 2 -> ... -> 6 ...
 * starting from the seed week.
 */
export function wfhGroupForWeek(weekStart: string): number {
  const seedWeek = getSeedWeekStart();
  const offset = weekOffset(seedWeek, weekStart);
  const cyclePos = ((offset % 6) + 6) % 6;
  return ((cyclePos + 5) % 6) + 1;
}

/**
 * Reset (2026-07-17): everyone starts fresh from FIRST_BOOKABLE_WEEK regardless of past
 * attendance/rotation history — nobody is WFH for their first 5 weeks (2026-08-03 through
 * 2026-08-31). The normal 1-in-6 WFH rotation only kicks in from the 6th week onward; which
 * group draws which week within that rotation is still to be finalized separately.
 */
const ROTATION_GRACE_END = addWeeks(FIRST_BOOKABLE_WEEK, 5);

export function isGroupWfh(groupNumber: number, weekStart: string): boolean {
  if (weekStart < ROTATION_GRACE_END) return false;
  return groupNumber === wfhGroupForWeek(weekStart);
}

/**
 * How many consecutive weeks starting at `weekStart` (inclusive) the group stays in-office
 * before hitting its next WFH week, capped at `cap`. Since the cycle is 5-in/1-out, this is
 * naturally at most 5 — used to cap/pre-fill the "how many weeks in a row" booking input so
 * nobody books past the week they'll be WFH anyway.
 */
export function weeksUntilWfh(groupNumber: number, weekStart: string, cap = 5): number {
  let count = 0;
  let w = weekStart;
  while (count < cap) {
    if (isGroupWfh(groupNumber, w)) break;
    count++;
    w = addWeeks(w, 1);
  }
  return Math.max(1, count);
}

type TeamPool = { seatId: number; fullCode: string }[];

const poolCache = new Map<number, TeamPool>();

function getTeamPool(teamId: number): TeamPool {
  let pool = poolCache.get(teamId);
  if (pool) return pool;
  const db = getDb();
  pool = db
    .prepare(
      `SELECT s.id as seatId, s.full_code as fullCode
       FROM team_seats ts JOIN seats s ON s.id = ts.seat_id
       WHERE ts.team_id = ?
       ORDER BY ts.pool_order ASC`
    )
    .all(teamId) as TeamPool;
  poolCache.set(teamId, pool);
  return pool;
}

/** The seat an employee would auto-occupy in a given week, absent any manual booking/release.
 * Returns null both when the employee has no rotation seed and when their group is WFH that week. */
export function computeAutoSeat(
  employee: { id: number; team_id: number; group_number: number },
  weekStart: string
): { seatId: number; fullCode: string } | null {
  if (isGroupWfh(employee.group_number, weekStart)) return null;

  const db = getDb();
  const rotation = db
    .prepare(`SELECT initial_pool_index FROM employee_rotation WHERE employee_id = ?`)
    .get(employee.id) as { initial_pool_index: number } | undefined;
  if (!rotation) return null;

  const pool = getTeamPool(employee.team_id);
  if (pool.length === 0) return null;

  const index = (rotation.initial_pool_index % pool.length + pool.length) % pool.length;
  const seat = pool[index];
  return { seatId: seat.seatId, fullCode: seat.fullCode };
}

/** All employees whose auto-rotation lands them on the given seat for the given week (normally 0 or 1; can be >1 if two teams share a seat in their pools). */
export function computeAutoOccupants(
  seatId: number,
  weekStart: string
): { id: number; name: string; team_id: number }[] {
  const db = getDb();
  const employees = db
    .prepare(
      `SELECT e.id, e.name, e.team_id, e.group_number FROM employees e
       JOIN employee_rotation er ON er.employee_id = e.id
       WHERE e.active = 1`
    )
    .all() as { id: number; name: string; team_id: number; group_number: number }[];

  return employees.filter((e) => computeAutoSeat(e, weekStart)?.seatId === seatId);
}
