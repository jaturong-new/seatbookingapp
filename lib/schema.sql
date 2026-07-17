CREATE TABLE IF NOT EXISTS floors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

-- row_letter/col_number are the seat's own label (e.g. "K2"); grid_row/grid_col are its
-- actual position on the floor plan (derived from the real office floor-plan PDF), used for
-- layout. The two are independent: seat codes on the same physical wall can be laid out as a
-- vertical column of desks (grid_col fixed, grid_row increasing) even though their code numbers
-- don't run top-to-bottom, so layout must never be inferred from row_letter/col_number alone.
CREATE TABLE IF NOT EXISTS seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  floor_id INTEGER NOT NULL REFERENCES floors(id),
  row_letter TEXT NOT NULL,
  col_number INTEGER NOT NULL,
  code TEXT NOT NULL,
  full_code TEXT NOT NULL UNIQUE,
  grid_row INTEGER NOT NULL,
  grid_col INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- group_number (1-4): the real office policy splits each team into 4 even groups; every week
-- 3 of the 4 groups are in-office and 1 is WFH (see week_group_is_wfh in rotation.ts). Real
-- per-person group membership isn't available from source data, so groups are assigned evenly
-- and deterministically (round-robin by roster order) rather than reflecting the real assignment.
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  active INTEGER NOT NULL DEFAULT 1,
  group_number INTEGER NOT NULL CHECK (group_number BETWEEN 1 AND 6)
);

CREATE TABLE IF NOT EXISTS team_seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  seat_id INTEGER NOT NULL REFERENCES seats(id),
  pool_order INTEGER NOT NULL,
  UNIQUE(team_id, seat_id)
);

-- initial_pool_index: where in the team's rotation pool this employee started.
-- seed_week_start: the week that snapshot was taken from (each employee reseeded independently
-- from their own last known real assignment, since teams' historical data coverage and any
-- gaps/holidays in between differ per employee) -- falls back to meta.seed_week_start when null.
CREATE TABLE IF NOT EXISTS employee_rotation (
  employee_id INTEGER PRIMARY KEY REFERENCES employees(id),
  initial_pool_index INTEGER NOT NULL,
  seed_week_start TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_id INTEGER NOT NULL REFERENCES seats(id),
  week_start TEXT NOT NULL,
  employee_id INTEGER REFERENCES employees(id),
  status TEXT NOT NULL CHECK (status IN ('booked', 'released')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(seat_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_bookings_week ON bookings(week_start);
CREATE INDEX IF NOT EXISTS idx_team_seats_team ON team_seats(team_id, pool_order);

-- an employee may hold at most one active (booked) seat per week
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_employee_booking
  ON bookings(employee_id, week_start)
  WHERE status = 'booked' AND employee_id IS NOT NULL;
