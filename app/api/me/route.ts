import { NextResponse } from "next/server";
import { AUTH_ENABLED, getSessionEmployee, getSessionUser } from "@/lib/auth";
import { getClaimableEmployees } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Who am I + which identity mode the app runs in. With auth on: session email + claimed
 * employee. getSessionEmployee() already tried an automatic name match before we get here, so
 * `employee: null` below means that failed (ambiguous name, format mismatch, or a fixed-seat
 * lead who can't self-claim at all) -- the client falls back to a manual picker, so this
 * response carries the still-open names/teams to fill it (no emails; this app already shows
 * full rosters by name on every team page to any signed-in user, so this isn't new exposure). */
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
      claimable: getClaimableEmployees(),
    });
  }
  return NextResponse.json({
    authEnabled: true,
    signedIn: true,
    email,
    employee: { id: employee.id, name: employee.name, team_name: employee.team_name },
  });
}
