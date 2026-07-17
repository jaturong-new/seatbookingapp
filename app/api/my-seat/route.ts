import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getEmployeeById, getEmployeeWeekSeat } from "@/lib/queries";
import { weekStartOf, clampToFirstWeek } from "@/lib/rotation";

export async function GET(req: NextRequest) {
  const employeeId = Number(req.nextUrl.searchParams.get("employeeId"));
  const week = clampToFirstWeek(req.nextUrl.searchParams.get("week") ?? weekStartOf(new Date()));

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  }
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

  return NextResponse.json({ employee, week, seat, floor });
}
