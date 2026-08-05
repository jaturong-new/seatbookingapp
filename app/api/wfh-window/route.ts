import { NextRequest, NextResponse } from "next/server";
import { getEmployeeById } from "@/lib/queries";
import { weeksUntilWfh } from "@/lib/rotation";
import { hasReadAccess } from "@/lib/auth";

/** How many consecutive weeks (capped at 5) an employee can book in a row before their next WFH week. */
export async function GET(req: NextRequest) {
  if (!(await hasReadAccess())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const employeeId = Number(req.nextUrl.searchParams.get("employeeId"));
  const week = req.nextUrl.searchParams.get("week");
  if (!employeeId || !week) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const employee = getEmployeeById(employeeId);
  if (!employee) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const weeksAvailable = weeksUntilWfh(employee.group_number, week, 5);
  return NextResponse.json({ weeksAvailable });
}
