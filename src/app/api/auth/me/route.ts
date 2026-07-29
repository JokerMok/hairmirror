import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user)
    return NextResponse.json(
      { user: null },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  return NextResponse.json(
    { user },
    { headers: { "cache-control": "no-store" } },
  );
}
