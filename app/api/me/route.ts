import { NextResponse } from "next/server";
import { AUTH_ENABLED, getSessionEmployee, getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Who am I + which identity mode the app runs in. With auth on: session email + claimed
 * employee, plus the Google account's display name when not yet claimed (shown as-is; the
 * claim picker itself is disabled for now, so this intentionally never returns the roster). */
export async function GET() {
  if (!AUTH_ENABLED) {
    return NextResponse.json({ authEnabled: false });
  }
  const { email, employee } = await getSessionEmployee();
  if (!email) {
    return NextResponse.json({ authEnabled: true, signedIn: false });
  }
  if (!employee) {
    const { name } = await getSessionUser();
    return NextResponse.json({
      authEnabled: true,
      signedIn: true,
      email,
      name,
      employee: null,
    });
  }
  return NextResponse.json({
    authEnabled: true,
    signedIn: true,
    email,
    employee: { id: employee.id, name: employee.name, team_name: employee.team_name },
  });
}
