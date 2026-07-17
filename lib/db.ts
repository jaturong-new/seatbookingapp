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

function createConnection(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  return db;
}

export function getDb(): Database.Database {
  if (!global.__seatDb) {
    global.__seatDb = createConnection();
  }
  return global.__seatDb;
}
