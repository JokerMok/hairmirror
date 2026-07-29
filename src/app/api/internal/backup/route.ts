import { NextRequest, NextResponse } from "next/server";
import { createBackup } from "@/lib/backup";
import { isInternalRequest } from "@/lib/session";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isInternalRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    return NextResponse.json({ backup: await createBackup() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "BACKUP_FAILED",
        message: error instanceof Error ? error.message : "UNKNOWN",
      },
      { status: 500 },
    );
  }
}
