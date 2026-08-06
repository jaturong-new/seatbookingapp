import { NextResponse } from "next/server";
import { getEmployees } from "@/lib/queries";
import { AUTH_ENABLED, hasReadAccess } from "@/lib/auth";

// Reads the DB on every request. Without this Next prerenders the roster at build time and the
// identity picker freezes on whoever was active back then (admin toggles and email claims never show).
export const dynamic = "force-dynamic";

/** Only the legacy free-form picker (auth disabled) needs the full roster to populate its
 * dropdown. With auth on, identity comes from /api/me and this would otherwise let any signed-in
 * user pull every employee's name/team/id in one request for no reason — so it's disabled outright. */
export async function GET() {
  if (AUTH_ENABLED) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await hasReadAccess())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getEmployees());
}
