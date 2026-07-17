import fs from "fs";
import path from "path";
import { getDb } from "./db";

type SeedData = {
  seed_week_start: string;
  floors: { code: string; name: string }[];
  seats: {
    floor_code: string;
    row_letter: string;
    col_number: number;
    code: string;
    full_code: string;
    grid_row: number;
    grid_col: number;
  }[];
  teams: { name: string }[];
  employees: { name: string; team_name: string; group_number?: number }[];
  team_seats: { team_name: string; seat_full_code: string; pool_order: number }[];
  initial_assignment: { seat_full_code: string; employee_name: string; team_name: string }[];
};

function main() {
  const seedPath = path.join(process.cwd(), "data", "seed.json");
  const seed: SeedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
  const db = getDb();

  const insertMeta = db.prepare(
    `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
  );
  insertMeta.run();

  const already = db.prepare(`SELECT value FROM meta WHERE key = 'seed_week_start'`).get() as
    | { value: string }
    | undefined;
  if (already && !process.argv.includes("--force")) {
    console.log(
      `Already seeded (seed_week_start=${already.value}). Pass --force to re-seed (this will duplicate data unless the DB file is deleted first).`
    );
    return;
  }

  const run = db.transaction((seed: SeedData) => {
    const floorId = new Map<string, number>();
    const seatId = new Map<string, number>();
    const teamId = new Map<string, number>();
    const employeeId = new Map<string, number>();

    const insFloor = db.prepare(`INSERT OR IGNORE INTO floors (code, name) VALUES (?, ?)`);
    const getFloor = db.prepare(`SELECT id FROM floors WHERE code = ?`);
    for (const f of seed.floors) {
      insFloor.run(f.code, f.name);
      const row = getFloor.get(f.code) as { id: number };
      floorId.set(f.code, row.id);
    }

    const insSeat = db.prepare(
      `INSERT OR IGNORE INTO seats (floor_id, row_letter, col_number, code, full_code, grid_row, grid_col)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const getSeat = db.prepare(`SELECT id FROM seats WHERE full_code = ?`);
    for (const s of seed.seats) {
      const fId = floorId.get(s.floor_code);
      if (!fId) continue;
      insSeat.run(fId, s.row_letter, s.col_number, s.code, s.full_code, s.grid_row, s.grid_col);
      const row = getSeat.get(s.full_code) as { id: number };
      seatId.set(s.full_code, row.id);
    }

    const insTeam = db.prepare(`INSERT OR IGNORE INTO teams (name) VALUES (?)`);
    const getTeam = db.prepare(`SELECT id FROM teams WHERE name = ?`);
    for (const t of seed.teams) {
      insTeam.run(t.name);
      const row = getTeam.get(t.name) as { id: number };
      teamId.set(t.name, row.id);
    }

    const insEmployee = db.prepare(
      `INSERT INTO employees (name, team_id, group_number) VALUES (?, ?, ?)`
    );
    const teamRosterIndex = new Map<string, number>();
    for (const e of seed.employees) {
      const tId = teamId.get(e.team_name);
      if (!tId) continue;
      const idx = teamRosterIndex.get(e.team_name) ?? 0;
      teamRosterIndex.set(e.team_name, idx + 1);
      const groupNumber = e.group_number ?? ((idx % 6) + 1);
      const info = insEmployee.run(e.name, tId, groupNumber);
      employeeId.set(`${e.team_name}:${e.name}`, info.lastInsertRowid as number);
    }

    const insTeamSeat = db.prepare(
      `INSERT OR IGNORE INTO team_seats (team_id, seat_id, pool_order) VALUES (?, ?, ?)`
    );
    // team_name -> ordered list of seat_ids (by pool_order), for computing initial_pool_index
    const poolByTeam = new Map<string, string[]>();
    for (const ts of seed.team_seats) {
      const tId = teamId.get(ts.team_name);
      const sId = seatId.get(ts.seat_full_code);
      if (!tId || !sId) continue;
      insTeamSeat.run(tId, sId, ts.pool_order);
      const arr = poolByTeam.get(ts.team_name) ?? [];
      arr[ts.pool_order] = ts.seat_full_code;
      poolByTeam.set(ts.team_name, arr);
    }

    const insRotation = db.prepare(
      `INSERT OR REPLACE INTO employee_rotation (employee_id, initial_pool_index) VALUES (?, ?)`
    );
    for (const a of seed.initial_assignment) {
      const empId = employeeId.get(`${a.team_name}:${a.employee_name}`);
      const pool = poolByTeam.get(a.team_name) ?? [];
      const idx = pool.indexOf(a.seat_full_code);
      if (empId != null && idx >= 0) {
        insRotation.run(empId, idx);
      }
    }

    db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('seed_week_start', ?)`).run(
      seed.seed_week_start
    );
  });

  run(seed);

  console.log(
    `Seeded: ${seed.floors.length} floors, ${seed.seats.length} seats, ${seed.teams.length} teams, ${seed.employees.length} employees, week start ${seed.seed_week_start}`
  );
}

main();
