import { NextRequest, NextResponse } from "next/server";
import { AUTH_ENABLED, getSessionEmployee } from "@/lib/auth";
import { claimEmployeeEmail, getEmployeeById } from "@/lib/queries";

/** First-login claim: bind the signed-in Google email to the chosen employee name (once, permanently). */
export async function POST(req: NextRequest) {
  if (!AUTH_ENABLED) {
    return NextResponse.json({ ok: false, error: "auth_disabled" }, { status: 404 });
  }
  const { email, employee } = await getSessionEmployee();
  if (!email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (employee) {
    return NextResponse.json({ ok: false, error: "already_claimed" }, { status: 409 });
  }

  const body = (await req.json()) as { employeeId?: number };
  const employeeId = Number(body.employeeId);
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const result = claimEmployeeEmail(employeeId, email);
  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }
  const claimed = getEmployeeById(employeeId)!;
  return NextResponse.json({
    ok: true,
    employee: { id: claimed.id, name: claimed.name, team_name: claimed.team_name },
  });
}
