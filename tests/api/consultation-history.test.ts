import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { DELETE, GET } from "../../src/app/api/consultations/history/route";

describe("consultation history API", () => {
  it("requires authentication for listing and deletion", async () => {
    const request = new NextRequest("http://localhost/api/consultations/history");
    expect((await GET(request)).status).toBe(401);
    expect((await DELETE(request)).status).toBe(401);
  });
});
