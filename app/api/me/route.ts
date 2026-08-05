import { NextResponse } from "next/server";
import { AUTH_ENABLED, getSessionEmployee, getSessionUser } from "@/lib/auth";
import { getUnclaimedEmployees } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Who am I + which identity mode the app runs in. With auth on: session email + claimed
 * employee; when signed in but unclaimed, also returns the names still available (plus the
 * Google account's display name, for pre-matching) so the client can render the claim picker.
 * With auth off the client falls back to the legacy picker. */
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
      unclaimed: getUnclaimedEmployees(),
    });
  }
  return NextResponse.json({
    authEnabled: true,
    signedIn: true,
    email,
    employee: { id: employee.id, name: employee.name, team_name: employee.team_name },
  });
}
