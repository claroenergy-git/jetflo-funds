// Review mode navigation rules — run with `npm test` (Node's built-in test runner).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareQueue,
  sortQueue,
  isActionableBy,
  reviewPosition,
  parseReviewStart,
  reviewHref,
  reviewDoneHref,
} from "../../src/lib/review-queue.ts";

const ME = "user-me";
const OTHER = "user-other";
const item = (id, urgency, submitted_at, status = "submitted", approverId = null) => ({
  id,
  urgency,
  submitted_at,
  status,
  approver: approverId ? { id: approverId } : null,
});

const crit = item("c1", "critical", "2026-11-18T10:00:00Z");
const urg1 = item("u1", "urgent", "2026-11-17T10:00:00Z");
const urg2 = item("u2", "urgent", "2026-11-19T10:00:00Z");
const norm = item("n1", "normal", "2026-11-10T10:00:00Z");

test("orders by urgency, then oldest submission, then id", () => {
  const sorted = sortQueue([norm, urg2, crit, urg1]).map((r) => r.id);
  assert.deepEqual(sorted, ["c1", "u1", "u2", "n1"]);
  const a = item("a", "normal", "2026-11-10T10:00:00Z");
  const b = item("b", "normal", "2026-11-10T10:00:00Z");
  assert.ok(compareQueue(a, b) < 0);
});

test("sortQueue does not mutate its input", () => {
  const input = [norm, crit];
  sortQueue(input);
  assert.deepEqual(input.map((r) => r.id), ["n1", "c1"]);
});

test("unknown urgency and missing submitted_at sort last", () => {
  const weird = item("w", "someday", "2026-11-01T00:00:00Z");
  const noDate = item("x", "normal", null);
  assert.deepEqual(sortQueue([weird, noDate, norm]).map((r) => r.id), ["n1", "x", "w"]);
});

test("actionable: submitted yes; second approval only when I wasn't first approver; decided no", () => {
  assert.equal(isActionableBy(item("a", "normal", null, "submitted"), ME), true);
  assert.equal(isActionableBy(item("a", "normal", null, "awaiting_second_approval", OTHER), ME), true);
  assert.equal(isActionableBy(item("a", "normal", null, "awaiting_second_approval", ME), ME), false);
  for (const s of ["approved", "partially_approved", "rejected", "sent_back", "draft", "paid", "closed"]) {
    assert.equal(isActionableBy(item("a", "normal", null, s), ME), false, s);
  }
});

test("middle of the queue has prev and next", () => {
  const pos = reviewPosition([norm, urg2, crit, urg1], urg1, ME);
  assert.equal(pos.prev?.id, "c1");
  assert.equal(pos.next?.id, "u2");
  assert.equal(pos.before, 1);
  assert.equal(pos.after, 2);
});

test("start of the queue: no prev", () => {
  const pos = reviewPosition([norm, urg2, crit, urg1], crit, ME);
  assert.equal(pos.prev, null);
  assert.equal(pos.next?.id, "u1");
});

test("end of the queue: no next", () => {
  const pos = reviewPosition([norm, urg2, crit, urg1], norm, ME);
  assert.equal(pos.next, null);
  assert.equal(pos.prev?.id, "u2");
  assert.equal(pos.after, 0);
});

test("decided items are skipped by prev/next", () => {
  const decided = { ...urg1, status: "approved" };
  const pos = reviewPosition([crit, decided, urg2, norm], urg2, ME);
  assert.equal(pos.prev?.id, "c1");
  const pos2 = reviewPosition([{ ...crit, status: "rejected" }, decided, urg2, norm], urg2, ME);
  assert.equal(pos2.prev, null, "everything before is decided → no pending before this");
});

test("still works after the current request was decided and left the pending list", () => {
  const justApproved = { ...urg1, status: "approved" };
  // the pending list fetched after the decision no longer contains urg1
  const pos = reviewPosition([crit, urg2, norm], justApproved, ME);
  assert.equal(pos.prev?.id, "c1");
  assert.equal(pos.next?.id, "u2");
});

test("my own first approval awaiting a second approver is skipped", () => {
  const mine = item("m", "urgent", "2026-11-18T00:00:00Z", "awaiting_second_approval", ME);
  const pos = reviewPosition([crit, mine, urg2], crit, ME);
  assert.equal(pos.next?.id, "u2");
  assert.equal(pos.after, 1);
});

test("parseReviewStart accepts epoch ms, rejects junk and future values", () => {
  const now = 1_795_000_000_000;
  assert.equal(parseReviewStart(String(now - 1000), now), now - 1000);
  assert.equal(parseReviewStart([String(now)], now), now);
  assert.equal(parseReviewStart("1", now), null);
  assert.equal(parseReviewStart("abc", now), null);
  assert.equal(parseReviewStart(undefined, now), null);
  assert.equal(parseReviewStart(String(now + 3_600_000), now), null);
});

test("hrefs", () => {
  assert.equal(reviewHref("abc", 123), "/requests/abc?review=123#decision");
  assert.equal(reviewDoneHref(123), "/finance/queue/review-done?since=123");
});
