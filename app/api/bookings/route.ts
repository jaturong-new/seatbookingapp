import { NextRequest, NextResponse } from "next/server";
import { bookSeat, releaseSeat, clearOverride } from "@/lib/queries";

type Body = {
  action: "book" | "release" | "clear";
  seatId: number;
  weekStart: string;
  employeeId?: number;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const { action, seatId, weekStart } = body;

  if (!seatId || !weekStart) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  if (action === "book") {
    if (!body.employeeId) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }
    const result = bookSeat(seatId, weekStart, body.employeeId);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  }

  if (action === "release") {
    const result = releaseSeat(seatId, weekStart);
    return NextResponse.json(result);
  }

  if (action === "clear") {
    const result = clearOverride(seatId, weekStart);
    return NextResponse.json(result);
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
