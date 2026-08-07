import fs from "fs";
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth";
import { getDb, getDbPath } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Download the live database file -- for pulling a copy down before a deploy that would
 * otherwise overwrite it with the build-time snapshot (see DEPLOY-README's volume-removal step;
 * this is the "grab a backup first" half of that). WAL mode keeps recent writes in a
 * `-wal` sidecar next to the main file, so a plain file copy can miss them; checkpointing first
 * merges everything into the one file this route actually reads. */
export async function GET() {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  getDb().pragma("wal_checkpoint(TRUNCATE)");
  const bytes = fs.readFileSync(getDbPath());
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="seatbooking-${stamp}.db"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
    },
  });
}
