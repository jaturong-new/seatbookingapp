import { NextResponse } from "next/server";
import { getEmployees } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(getEmployees());
}
