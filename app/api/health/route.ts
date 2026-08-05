import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Without this Next prerenders the response once at build time (against the build-time DB
// snapshot, before the runtime volume is even mounted) and serves that same frozen result
// forever -- exactly the failure mode this check exists to catch.
export const dynamic = "force-dynamic";

// Deliberately unauthenticated: Docker's HEALTHCHECK has no session cookie to send, so this
// route must stay outside the login gate that the rest of the API is behind. It only proves the
// DB volume is mounted and writable/readable -- no app data (seats, names) is exposed.
export async function GET() {
  try {
    getDb().prepare("SELECT 1").get();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
