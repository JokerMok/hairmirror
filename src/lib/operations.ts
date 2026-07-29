import { db } from "./database";

type Level = "info" | "warning" | "critical";
type AlertInput = {
  code: string;
  severity: "warning" | "critical";
  active: boolean;
  message: string;
  details: Record<string, unknown>;
};
function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function recordOperationalEvent(
  level: Level,
  eventType: string,
  message: string,
  resourceId: string | null = null,
  details: Record<string, unknown> = {},
) {
  try {
    db()
      .prepare(
        "INSERT INTO operational_events(id,level,event_type,resource_id,message,details_json,created_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        crypto.randomUUID(),
        level,
        eventType,
        resourceId,
        message,
        JSON.stringify(details),
        new Date().toISOString(),
      );
    return true;
  } catch {
    return false;
  }
}

export function operationsHealth(now = Date.now()) {
  const database = db();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const jobs = database
    .prepare(
      `SELECT
    SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queued,
    SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) AS processing,
    SUM(CASE WHEN status='failed' AND completed_at>=? THEN 1 ELSE 0 END) AS failed_hour,
    SUM(CASE WHEN status='completed' AND completed_at>=? THEN 1 ELSE 0 END) AS completed_hour,
    COALESCE(SUM(CASE WHEN queued_at>=? THEN actual_cost_micros ELSE 0 END),0) AS cost_day,
    MIN(CASE WHEN status='queued' THEN queued_at END) AS oldest_queued
    FROM generation_jobs`,
    )
    .get(hourAgo, hourAgo, dayAgo) as Record<string, unknown>;
  const staleMs = positiveNumber(process.env.JOB_STALE_MS, 15 * 60 * 1000);
  const stale = (
    database
      .prepare(
        "SELECT COUNT(*) AS count FROM generation_jobs j JOIN generation_job_payloads p ON p.job_id=j.id WHERE j.status='processing' AND COALESCE(p.heartbeat_at,p.locked_at,0)<?",
      )
      .get(now - staleMs) as { count: number }
  ).count;
  const failedHour = Number(jobs.failed_hour ?? 0);
  const completedHour = Number(jobs.completed_hour ?? 0);
  const attempts = failedHour + completedHour;
  const oldestQueuedAt = jobs.oldest_queued
    ? Date.parse(String(jobs.oldest_queued))
    : null;
  return {
    status: stale > 0 ? "degraded" : "ok",
    queued: Number(jobs.queued ?? 0),
    processing: Number(jobs.processing ?? 0),
    failedHour,
    completedHour,
    failureRate: attempts ? failedHour / attempts : 0,
    dailyCostMicros: Number(jobs.cost_day ?? 0),
    oldestQueuedAgeMs: oldestQueuedAt ? Math.max(0, now - oldestQueuedAt) : 0,
    staleJobs: Number(stale),
    checkedAt: new Date(now).toISOString(),
  };
}

export function evaluateOperationalAlerts(now = Date.now()) {
  const health = operationsHealth(now);
  const minSamples = positiveNumber(process.env.ALERT_FAILURE_MIN_SAMPLES, 5);
  const failureThreshold = positiveNumber(process.env.ALERT_FAILURE_RATE, 0.2);
  const backlogMs = positiveNumber(
    process.env.ALERT_QUEUE_AGE_MS,
    5 * 60 * 1000,
  );
  const costThreshold = positiveNumber(
    process.env.ALERT_DAILY_COST_MICROS,
    10_000_000,
  );
  const alerts: AlertInput[] = [
    {
      code: "STALE_JOB",
      severity: "critical",
      active: health.staleJobs > 0,
      message: "存在失去心跳的生成任务",
      details: { staleJobs: health.staleJobs },
    },
    {
      code: "QUEUE_BACKLOG",
      severity: "warning",
      active: health.oldestQueuedAgeMs > backlogMs,
      message: "生成队列等待时间超过阈值",
      details: {
        oldestQueuedAgeMs: health.oldestQueuedAgeMs,
        thresholdMs: backlogMs,
      },
    },
    {
      code: "FAILURE_RATE",
      severity: "critical",
      active:
        health.failedHour + health.completedHour >= minSamples &&
        health.failureRate >= failureThreshold,
      message: "最近一小时生成失败率过高",
      details: {
        failureRate: health.failureRate,
        samples: health.failedHour + health.completedHour,
      },
    },
    {
      code: "DAILY_COST",
      severity: "warning",
      active: health.dailyCostMicros >= costThreshold,
      message: "最近 24 小时生成成本达到告警线",
      details: {
        dailyCostMicros: health.dailyCostMicros,
        thresholdMicros: costThreshold,
      },
    },
  ];
  const database = db();
  const timestamp = new Date(now).toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const alert of alerts) {
      if (alert.active)
        database
          .prepare(
            `INSERT INTO operational_alerts(code,severity,status,message,details_json,first_seen_at,last_seen_at,notified_at) VALUES(?,?,'open',?,?,?,?,NULL)
      ON CONFLICT(code) DO UPDATE SET severity=excluded.severity,status='open',message=excluded.message,details_json=excluded.details_json,last_seen_at=excluded.last_seen_at,notified_at=CASE WHEN operational_alerts.status='resolved' THEN NULL ELSE operational_alerts.notified_at END`,
          )
          .run(
            alert.code,
            alert.severity,
            alert.message,
            JSON.stringify(alert.details),
            timestamp,
            timestamp,
          );
      else
        database
          .prepare(
            "UPDATE operational_alerts SET status='resolved',last_seen_at=? WHERE code=? AND status='open'",
          )
          .run(timestamp, alert.code);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { health, alerts: listOperationalAlerts("open") };
}

export function listOperationalAlerts(status?: "open" | "resolved") {
  return (
    status
      ? db()
          .prepare(
            "SELECT * FROM operational_alerts WHERE status=? ORDER BY last_seen_at DESC",
          )
          .all(status)
      : db()
          .prepare(
            "SELECT * FROM operational_alerts ORDER BY last_seen_at DESC LIMIT 100",
          )
          .all()
  ) as Array<Record<string, unknown>>;
}
export function listOperationalEvents() {
  return db()
    .prepare(
      "SELECT * FROM operational_events ORDER BY created_at DESC LIMIT 100",
    )
    .all() as Array<Record<string, unknown>>;
}

export async function notifyOpenAlerts() {
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) return { sent: 0, configured: false };
  const pending = db()
    .prepare(
      "SELECT * FROM operational_alerts WHERE status='open' AND notified_at IS NULL ORDER BY first_seen_at",
    )
    .all() as Array<Record<string, unknown>>;
  let sent = 0;
  for (const alert of pending) {
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product: "发型镜",
          code: alert.code,
          severity: alert.severity,
          message: alert.message,
          details: JSON.parse(String(alert.details_json)),
          occurredAt: alert.last_seen_at,
        }),
      });
      if (response.ok) {
        db()
          .prepare("UPDATE operational_alerts SET notified_at=? WHERE code=?")
          .run(new Date().toISOString(), String(alert.code));
        sent += 1;
      }
    } catch (error) {
      recordOperationalEvent(
        "warning",
        "alert.delivery_failed",
        "告警通知发送失败",
        String(alert.code),
        { message: error instanceof Error ? error.message : "UNKNOWN" },
      );
    }
  }
  return { sent, configured: true };
}
