import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getEmployeeById, getEmployeeWeekSeat } from "@/lib/queries";
import { weekStartOf, clampToFirstWeek } from "@/lib/rotation";
import { resolveRequestedEmployeeId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Identity comes from the session when auth is on — the employeeId in the query string is
  // only cross-checked, never trusted as the lookup key.
  const idParam = Number(req.nextUrl.searchParams.get("employeeId")) || null;
  const resolved = await resolveRequestedEmployeeId(idParam);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const employeeId = resolved.employeeId;
  const week = clampToFirstWeek(req.nextUrl.searchParams.get("week") ?? weekStartOf(new Date()));

  const employee = getEmployeeById(employeeId);
  if (!employee) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const seat = getEmployeeWeekSeat(employeeId, week);
  const floor =
    seat && seat.source !== "wfh"
      ? (getDb().prepare(`SELECT code, name FROM floors WHERE id = ?`).get(seat.floor_id) as {
          code: string;
          name: string;
        })
      : null;

  // Only the fields the card renders. Never spread the employee row straight out: it carries the
  // person's Google email, which nothing on this screen needs.
  return NextResponse.json({
    employee: { id: employee.id, name: employee.name, team_name: employee.team_name },
    week,
    seat,
    floor,
  });
}
