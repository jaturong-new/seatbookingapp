import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// SEAT_DB_PATH keeps the database outside the deployed app directory. It matters because
// `next build` traces seatbooking.db into .next/standalone/, so a deploy that copies the build
// output over the app would otherwise overwrite live bookings with the build-time snapshot.
// In Docker point it at a mounted volume (e.g. /data/seatbooking.db); WAL also needs the
// containing directory to be writable, not just the file.
const DB_PATH = process.env.SEAT_DB_PATH
  ? path.resolve(process.env.SEAT_DB_PATH)
  : path.join(process.cwd(), "seatbooking.db");
const SCHEMA_PATH = path.join(process.cwd(), "lib", "schema.sql");

declare global {
  // eslint-disable-next-line no-var
  var __seatDb: Database.Database | undefined;
}

function migrate(db: Database.Database) {
  // schema.sql only creates missing tables; existing DBs need the email column added in place
  const cols = db.prepare(`PRAGMA table_info(employees)`).all() as { name: string }[];
  if (cols.length > 0 && !cols.some((c) => c.name === "email")) {
    db.exec(`ALTER TABLE employees ADD COLUMN email TEXT`);
  }
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email ON employees(email) WHERE email IS NOT NULL`
  );

  const teamCols = db.prepare(`PRAGMA table_info(teams)`).all() as { name: string }[];
  if (teamCols.length > 0 && !teamCols.some((c) => c.name === "color")) {
    db.exec(`ALTER TABLE teams ADD COLUMN color TEXT`);
  }

  // ALTER TABLE can't add the CHECK constraint schema.sql declares for fresh DBs; the values
  // are only ever written by hand, so an unconstrained column here is close enough.
  const seatCols = db.prepare(`PRAGMA table_info(seats)`).all() as { name: string }[];
  if (seatCols.length > 0 && !seatCols.some((c) => c.name === "rank")) {
    db.exec(`ALTER TABLE seats ADD COLUMN rank TEXT`);
  }
}

function createConnection(): Database.Database {
  // A freshly mounted volume may not have the directory yet; schema.sql then creates the tables.
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  migrate(db);
  return db;
}

export function getDb(): Database.Database {
  if (!global.__seatDb) {
    global.__seatDb = createConnection();
  }
  return global.__seatDb;
}

/** Where the live database file sits on disk -- for the admin DB-export route, which needs the
 * path to stream the file itself, not just a connection to query it. */
export function getDbPath(): string {
  return DB_PATH;
}
