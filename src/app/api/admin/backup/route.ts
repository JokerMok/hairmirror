import { NextRequest, NextResponse } from "next/server";
import { createBackup } from "@/lib/backup";
import { isAdminRequest, safeRedirectUrl } from "@/lib/session";
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  await createBackup();
  return NextResponse.redirect(
    safeRedirectUrl(request, "/admin/operations"),
    303,
  );
}
