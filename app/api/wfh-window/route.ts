import { NextRequest, NextResponse } from "next/server";
import { getEmployeeById } from "@/lib/queries";
import { weeksUntilWfh } from "@/lib/rotation";
import { resolveRequestedEmployeeId } from "@/lib/auth";

/** How many consecutive weeks (capped at 5) an employee can book in a row before their next WFH week. */
export async function GET(req: NextRequest) {
  // Same rule as /api/my-seat: with auth on, only ever answers about the signed-in person.
  const idParam = Number(req.nextUrl.searchParams.get("employeeId")) || null;
  const resolved = await resolveRequestedEmployeeId(idParam);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const week = req.nextUrl.searchParams.get("week");
  if (!week) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const employee = getEmployeeById(resolved.employeeId);
  if (!employee) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const weeksAvailable = weeksUntilWfh(employee.group_number, week, 5);
  return NextResponse.json({ weeksAvailable });
}
