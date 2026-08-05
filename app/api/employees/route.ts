import { NextResponse } from "next/server";
import { getEmployees } from "@/lib/queries";
import { hasReadAccess } from "@/lib/auth";

// Reads the DB on every request. Without this Next prerenders the roster at build time and the
// identity picker freezes on whoever was active back then (admin toggles and email claims never show).
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasReadAccess())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getEmployees());
}
