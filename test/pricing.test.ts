import { describe, it, expect } from "vitest";
import { price, shingles, jaccard, isBulk, allowMatch, authFailed } from "../src/lib/pricing";

describe("pricing", () => {
  it("base price", () => expect(price({ base: 100, bulkScore: 0, dupes: 0, repDiscount: 0, max: 2500 })).toBe(100));
  it("bulk triples", () => expect(price({ base: 100, bulkScore: 1, dupes: 0, repDiscount: 0, max: 2500 })).toBe(300));
  it("dupes raise price, capped", () => {
    expect(price({ base: 100, bulkScore: 0, dupes: 4, repDiscount: 0, max: 2500 })).toBe(200);
    expect(price({ base: 100, bulkScore: 0, dupes: 100, repDiscount: 0, max: 2500 })).toBe(400);
  });
  it("floor and ceiling", () => {
    expect(price({ base: 100, bulkScore: 0, dupes: 0, repDiscount: 0.9, max: 2500 })).toBe(50);
    expect(price({ base: 2000, bulkScore: 1, dupes: 3, repDiscount: 0, max: 2500 })).toBe(2500);
  });
});
describe("similarity", () => {
  it("near-duplicates", () => {
    const a = shingles("Hi Sam, I help teams like Acme 10x their pipeline with AI SDRs. Open to a call?");
    const b = shingles("Hi Kim, I help teams like Beta 10x their pipeline with AI SDRs. Open to a call?");
    expect(jaccard(a, b)).toBeGreaterThan(0.6);
    expect(jaccard(a, shingles("Lunch tomorrow at noon? The new ramen place opened downtown."))).toBeLessThan(0.3);
  });
});
describe("rules", () => {
  it("bulk", () => {
    expect(isBulk({ "list-unsubscribe": "<x>" }, "a@b.com")).toBe(true);
    expect(isBulk({}, "noreply@b.com")).toBe(true);
    expect(isBulk({}, "sam@b.com")).toBe(false);
  });
  it("allowlist", () => {
    expect(allowMatch(["@acme.com"], "x@acme.com")).toBe(true);
    expect(allowMatch(["a@b.com"], "x@acme.com")).toBe(false);
  });
  it("auth", () => expect(authFailed({ "authentication-results": "mx; spf=fail; dkim=pass" })).toBe(true));
});
