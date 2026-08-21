import { NextRequest, NextResponse } from "next/server";
import { resetUserPassword } from "@/lib/model-operations";
import { isAdminRequest, safeRedirectUrl } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const result = resetUserPassword(id);
  if (!result.ok)
    return NextResponse.redirect(
      safeRedirectUrl(request, `/admin/users?error=${result.reason}`),
      303,
    );
  return NextResponse.redirect(
    safeRedirectUrl(request, "/admin/users?passwordReset=1"),
    303,
  );
}
