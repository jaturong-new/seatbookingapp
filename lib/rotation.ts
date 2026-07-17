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

export function getSeedWeekStart(): string {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'seed_week_start'`).get() as
    | { value: string }
    | undefined;
  return row?.value ?? weekStartOf(new Date());
}

/**
 * Real office policy: each team's roster is split into 4 even groups; every week 3 of the 4
 * groups are in-office and 1 is WFH, cycling so each person gets 1-in-4 weeks off
 * (office 3 weeks, WFH 1 week). The WFH group for a given week cycles 4 -> 1 -> 2 -> 3 -> 4 ...
 * starting from the seed week.
 */
export function wfhGroupForWeek(weekStart: string): number {
  const seedWeek = getSeedWeekStart();
  const offset = weekOffset(seedWeek, weekStart);
  const cyclePos = ((offset % 4) + 4) % 4;
  return ((cyclePos + 3) % 4) + 1;
}

export function isGroupWfh(groupNumber: number, weekStart: string): boolean {
  return groupNumber === wfhGroupForWeek(weekStart);
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

  const seedWeek = getSeedWeekStart();
  const offset = weekOffset(seedWeek, weekStart);
  const index = ((rotation.initial_pool_index + offset) % pool.length + pool.length) % pool.length;
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
