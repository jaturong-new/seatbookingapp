// Forced reload to clear db cache
delete (global as any).__seatDb;
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "seatbooking.db");
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
}

function createConnection(): Database.Database {
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
