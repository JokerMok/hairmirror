import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

afterEach(() => {
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.PUBLIC_APP_URL;
});

function loginRequest(username: string, password: string) {
  return new Request("https://hair.example/api/admin/login", {
    method: "POST",
    body: new URLSearchParams({ username, password }),
  });
}

describe("admin login", () => {
  it("sets the admin session for the configured account", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "admin_joker";

    const response = await POST(loginRequest("admin", "admin_joker"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://hair.example/admin");
    expect(response.headers.get("set-cookie")).toContain("hair_admin=");
  });

  it("rejects an incorrect password", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "admin_joker";

    const response = await POST(loginRequest("admin", "wrong-password"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://hair.example/admin?error=invalid",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
