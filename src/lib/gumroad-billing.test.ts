import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { entitledQuota } from "./billing";
import { hashPassword } from "./auth";
import { closeDatabaseForTest, db, getAuthUserById } from "./database";
import {
  activateGumroadPack,
  activateGumroadLicense,
  gumroadBillingState,
  refreshGumroadLicense,
} from "./gumroad-billing";

let directory = "";
const userId = "00000000-0000-4000-8000-000000000301";
const secondUserId = "00000000-0000-4000-8000-000000000302";
const productId = "product-personal==";
const licenseKey = "AAAA-BBBB-CCCC-DDDD";

function response(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      success: true,
      purchase: {
        product_id: productId,
        email: "buyer@example.com",
        currency: "usd",
        subscription_id: "sub-gumroad-1",
        sale_id: "sale-1",
        recurrence: "monthly",
        refunded: false,
        disputed: false,
        chargebacked: false,
        ...overrides,
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-gumroad-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.BILLING_PROVIDER = "gumroad";
  process.env.GUMROAD_PERSONAL_PRODUCT_ID = productId;
  process.env.GUMROAD_PERSONAL_PACK_PRODUCT_ID = "product-pack==";
  process.env.PERSONAL_PACK_SETS = "5";
  process.env.GUMROAD_SALON_PRODUCT_ID = "product-salon==";
  process.env.BILLING_SECRET_KEY = Buffer.alloc(32, 9).toString("base64");
  process.env.GUMROAD_REFRESH_INTERVAL_MS = "1";
  process.env.GUMROAD_VERIFICATION_GRACE_MS = String(72 * 60 * 60 * 1000);
  const insert = db().prepare(
    "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
  );
  insert.run(
    userId,
    `email-${userId}`,
    "buyer@example.com",
    "Buyer",
    hashPassword("password123"),
    new Date().toISOString(),
  );
  insert.run(
    secondUserId,
    `email-${secondUserId}`,
    "second@example.com",
    "Second",
    hashPassword("password123"),
    new Date().toISOString(),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  closeDatabaseForTest();
  for (const key of [
    "SQLITE_PATH",
    "BILLING_PROVIDER",
    "GUMROAD_PERSONAL_PRODUCT_ID",
    "GUMROAD_PERSONAL_PACK_PRODUCT_ID",
    "PERSONAL_PACK_SETS",
    "GUMROAD_SALON_PRODUCT_ID",
    "BILLING_SECRET_KEY",
    "GUMROAD_REFRESH_INTERVAL_MS",
    "GUMROAD_VERIFICATION_GRACE_MS",
  ])
    delete process.env[key];
  rmSync(directory, { recursive: true, force: true });
});

describe("Gumroad subscription entitlements", () => {
  it("grants a one-time personal pack exactly once", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      response({
        product_id: "product-pack==",
        subscription_id: undefined,
        recurrence: undefined,
        sale_id: "pack-sale-1",
      }),
    );
    const user = getAuthUserById(userId)!;
    await expect(activateGumroadPack(user, licenseKey)).resolves.toEqual({
      granted: true,
      setCount: 5,
    });
    await expect(activateGumroadPack(user, licenseKey)).resolves.toEqual({
      granted: false,
      setCount: 5,
    });
    const wallet = db()
      .prepare("SELECT credit_sets FROM generation_wallets WHERE user_id=?")
      .get(userId) as { credit_sets: number };
    expect(wallet.credit_sets).toBe(5);
  });

  it("rejects a refunded personal pack", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({
        product_id: "product-pack==",
        subscription_id: undefined,
        recurrence: undefined,
        sale_id: "pack-sale-refunded",
        refunded: true,
      }),
    );
    await expect(
      activateGumroadPack(getAuthUserById(userId)!, licenseKey),
    ).rejects.toThrow("LICENSE_INACTIVE");
  });

  it("activates a valid USD membership without incrementing key uses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response());
    const user = getAuthUserById(userId)!;
    const state = await activateGumroadLicense(
      user,
      "personal_plus",
      licenseKey,
    );
    expect(state?.status).toBe("active");
    expect(entitledQuota(user, 30)).toBe(60);
    const request = fetchMock.mock.calls[0][1];
    expect(String(request?.body)).toContain("increment_uses_count=false");
    const stored = db()
      .prepare(
        "SELECT encrypted_license_key,license_fingerprint FROM gumroad_licenses WHERE user_id=?",
      )
      .get(userId) as Record<string, string>;
    expect(stored.encrypted_license_key).not.toContain(licenseKey);
    expect(stored.license_fingerprint).toHaveLength(64);
  });

  it("rejects email mismatch and refunded purchases", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      response({ email: "someone@example.com" }),
    );
    await expect(
      activateGumroadLicense(
        getAuthUserById(userId)!,
        "personal_plus",
        licenseKey,
      ),
    ).rejects.toThrow("EMAIL_MISMATCH");

    vi.mocked(fetch).mockResolvedValueOnce(response({ refunded: true }));
    await expect(
      activateGumroadLicense(
        getAuthUserById(userId)!,
        "personal_plus",
        licenseKey,
      ),
    ).rejects.toThrow("LICENSE_INACTIVE");
  });

  it("prevents one license from being bound to two accounts", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(
        response({ email: "second@example.com", subscription_id: "sub-gumroad-1" }),
      );
    await activateGumroadLicense(
      getAuthUserById(userId)!,
      "personal_plus",
      licenseKey,
    );
    await expect(
      activateGumroadLicense(
        getAuthUserById(secondUserId)!,
        "personal_plus",
        licenseKey,
      ),
    ).rejects.toThrow("LICENSE_ALREADY_BOUND");
  });

  it("honors a future cancellation and removes access after the end date", async () => {
    const now = Date.now();
    const end = now + 60_000;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({ subscription_cancelled_at: new Date(end).toISOString() }),
    );
    await activateGumroadLicense(
      getAuthUserById(userId)!,
      "personal_plus",
      licenseKey,
      now,
    );
    expect(gumroadBillingState(userId, now)?.cancelAtPeriodEnd).toBe(true);
    expect(gumroadBillingState(userId, end + 1)?.status).toBe("ended");
    expect(entitledQuota(getAuthUserById(userId)!, 30, end + 1)).toBe(30);
  });

  it("uses a 72-hour verification grace period during an outage", async () => {
    const now = Date.now();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response());
    await activateGumroadLicense(
      getAuthUserById(userId)!,
      "personal_plus",
      licenseKey,
      now,
    );
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const withinGrace = await refreshGumroadLicense(userId, {
      force: true,
      now: now + 60_000,
    });
    expect(withinGrace?.status).toBe("active");
    const afterGrace = await refreshGumroadLicense(userId, {
      force: true,
      now: now + 72 * 60 * 60 * 1000 + 1,
    });
    expect(afterGrace?.status).toBe("stale");
    expect(entitledQuota(getAuthUserById(userId)!, 30, now + 72 * 60 * 60 * 1000 + 1)).toBe(30);
  });

  it("revokes access immediately when Gumroad confirms an invalid key", async () => {
    const now = Date.now();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response());
    await activateGumroadLicense(
      getAuthUserById(userId)!,
      "personal_plus",
      licenseKey,
      now,
    );
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 404 }),
    );
    const state = await refreshGumroadLicense(userId, {
      force: true,
      now: now + 60_000,
    });
    expect(state?.status).toBe("invalid");
    expect(entitledQuota(getAuthUserById(userId)!, 30, now + 60_000)).toBe(30);
  });

  it("shares Salon Pro allowance with staff in the same store", async () => {
    const ownerId = "00000000-0000-4000-8000-000000000303";
    const staffId = "00000000-0000-4000-8000-000000000304";
    const now = new Date().toISOString();
    const insert = db().prepare(
      "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,?,'active',?)",
    );
    insert.run(
      ownerId,
      `email-${ownerId}`,
      "owner@example.com",
      "Owner",
      hashPassword("password123"),
      "store_owner",
      now,
    );
    insert.run(
      staffId,
      `email-${staffId}`,
      "staff@example.com",
      "Staff",
      hashPassword("password123"),
      "staff",
      now,
    );
    db()
      .prepare("INSERT INTO stores(id,name,owner_user_id,created_at) VALUES(?,?,?,?)")
      .run("store-1", "Salon", ownerId, now);
    const membership = db().prepare(
      "INSERT INTO store_members(store_id,user_id,created_at) VALUES(?,?,?)",
    );
    membership.run("store-1", ownerId, now);
    membership.run("store-1", staffId, now);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({
        product_id: "product-salon==",
        email: "owner@example.com",
        subscription_id: "sub-salon-1",
      }),
    );
    await activateGumroadLicense(
      getAuthUserById(ownerId)!,
      "salon_pro",
      "SALON-AAAA-BBBB-CCCC",
    );
    expect(entitledQuota(getAuthUserById(staffId)!, 100)).toBe(600);
  });
});
