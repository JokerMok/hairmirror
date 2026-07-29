import { NextResponse } from "next/server";
import { operationsHealth } from "@/lib/operations";

export const runtime = "nodejs";
export function GET() {
  try {
    const health = operationsHealth();
    return NextResponse.json(
      { status: health.status, checkedAt: health.checkedAt },
      {
        status: health.status === "ok" ? 200 : 503,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
