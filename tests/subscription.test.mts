import assert from "node:assert/strict";
import { test } from "node:test";
import { addMonths, addDays } from "../src/lib/dates";
import { paymentPeriod, subscriptionStatus } from "../src/lib/subscription";

const u = (expiresAt: string | null, o = {}) => ({ expiresAt, exempt: false, suspended: false, ...o });

test("status transitions with grace", () => {
  assert.equal(subscriptionStatus(u("2026-11-30"), 3, "2026-11-30"), "active");
  assert.equal(subscriptionStatus(u("2026-11-30"), 3, "2026-12-01"), "grace");
  assert.equal(subscriptionStatus(u("2026-11-30"), 3, "2026-12-03"), "grace");
  assert.equal(subscriptionStatus(u("2026-11-30"), 3, "2026-12-04"), "locked");
  assert.equal(subscriptionStatus(u("2026-11-30"), 0, "2026-12-01"), "locked");
  assert.equal(subscriptionStatus(u(null), 3, "2026-12-01"), "locked");
  assert.equal(subscriptionStatus(u(null, { exempt: true }), 3, "2026-12-01"), "active");
  assert.equal(subscriptionStatus(u("2027-01-01", { suspended: true }), 3, "2026-12-01"), "locked");
});

test("month math clamps", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-15", 2), "2027-01-15");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("payment periods", () => {
  // active: continues from expiry
  assert.deepEqual(paymentPeriod(u("2026-11-30"), 1, 3, "2026-11-20"), { from: "2026-12-01", to: "2026-12-31" });
  // in grace: still continues, grace days are covered
  assert.deepEqual(paymentPeriod(u("2026-11-30"), 1, 3, "2026-12-02"), { from: "2026-12-01", to: "2026-12-31" });
  // locked: starts today
  assert.deepEqual(paymentPeriod(u("2026-11-30"), 2, 3, "2026-12-10"), { from: "2026-12-10", to: "2027-02-09" });
  // never paid
  assert.deepEqual(paymentPeriod(u(null), 1, 3, "2026-11-24"), { from: "2026-11-24", to: "2026-12-23" });
});
