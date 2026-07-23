import { NextRequest, NextResponse } from "next/server";
import { AUTH_ENABLED, getSessionEmployee } from "@/lib/auth";
import { BOOKING_ENABLED } from "@/lib/config";
import { bookSeat, releaseSeat, clearOverride, getSeatById, getSeatAssignment } from "@/lib/queries";

type Body = {
  action: "book" | "release" | "clear";
  seatId: number;
  weekStart: string;
  employeeId?: number; // legacy mode only — ignored when auth is enabled
  weeks?: number;
};

export async function POST(req: NextRequest) {
  if (!BOOKING_ENABLED) {
    return NextResponse.json({ ok: false, error: "booking_disabled" }, { status: 503 });
  }

  const body = (await req.json()) as Body;
  const { action, seatId, weekStart } = body;

  if (!seatId || !weekStart) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  // Legacy mode (AUTH_ENABLED off): original behavior — identity trusted from the client.
  if (!AUTH_ENABLED) {
    if (action === "book") {
      if (!body.employeeId) {
        return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
      }
      const result = bookSeat(seatId, weekStart, body.employeeId, body.weeks ?? 1);
      return NextResponse.json(result, { status: result.ok ? 200 : 409 });
    }
    if (action === "release") return NextResponse.json(releaseSeat(seatId, weekStart));
    if (action === "clear") return NextResponse.json(clearOverride(seatId, weekStart));
    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  }

  // Auth mode: identity comes from the Google session, never from the request body —
  // a user can only ever book/release/clear as themselves.
  const { email, employee } = await getSessionEmployee();
  if (!email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!employee) {
    return NextResponse.json({ ok: false, error: "not_mapped" }, { status: 403 });
  }

  if (action === "book") {
    const result = bookSeat(seatId, weekStart, employee.id, body.weeks ?? 1);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  }

  const seat = getSeatById(seatId);
  if (!seat) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const assignment = getSeatAssignment(seat, weekStart);

  if (action === "release") {
    if (assignment.employee?.id !== employee.id) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json(releaseSeat(seatId, weekStart));
  }

  if (action === "clear") {
    const mine =
      (assignment.source === "booked" && assignment.employee?.id === employee.id) ||
      (assignment.employee == null && assignment.autoEmployee?.id === employee.id);
    if (!mine) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json(clearOverride(seatId, weekStart));
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
