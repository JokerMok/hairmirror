import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import {
  analyticsEventSchema,
  recordAnalyticsEvent,
} from "@/lib/analytics-events";

export const runtime = "nodejs";

const MAX_EVENT_BYTES = 8 * 1024;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_EVENTS_PER_WINDOW = 120;
const requestBuckets = new Map<string, { startedAt: number; count: number }>();

function requestKey(request: NextRequest) {
  const session = request.cookies.get("hair_auth")?.value;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const source = session || forwarded || "anonymous";
  return createHash("sha256").update(source).digest("hex").slice(0, 24);
}

function allowRequest(request: NextRequest) {
  const now = Date.now();
  if (requestBuckets.size > 1000) {
    for (const [key, bucket] of requestBuckets) {
      if (now - bucket.startedAt >= WINDOW_MS) requestBuckets.delete(key);
    }
  }
  const key = requestKey(request);
  const bucket = requestBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (bucket.count >= MAX_EVENTS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_EVENT_BYTES)
    return NextResponse.json({ error: "ANALYTICS_EVENT_TOO_LARGE" }, { status: 413 });

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_EVENT_BYTES)
      return NextResponse.json({ error: "ANALYTICS_EVENT_TOO_LARGE" }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = analyticsEventSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        error: "INVALID_ANALYTICS_EVENT",
        fields: parsed.error.issues.map((issue) => issue.path.join(".")),
      },
      { status: 400 },
    );
  if (!allowRequest(request))
    return NextResponse.json({ error: "ANALYTICS_RATE_LIMITED" }, { status: 429 });
  try {
    const user = getRequestUser(request);
    const accepted = recordAnalyticsEvent(parsed.data, {
      user,
      anonymousToken: request.cookies.get("hair_auth")?.value,
    });
    if (!accepted)
      return NextResponse.json({ error: "ANALYTICS_NOT_RECORDED" }, { status: 503 });
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "ANALYTICS_NOT_RECORDED" }, { status: 503 });
  }
}
