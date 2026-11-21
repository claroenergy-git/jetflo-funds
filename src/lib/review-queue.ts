/**
 * Review mode — pure ordering / navigation rules for the finance approval queue.
 * No imports on purpose: shared by the queue page, the request page and the tests.
 * Spec: REVIEW-MODE-SPEC.md
 */

export const PENDING_STATUSES = ["submitted", "awaiting_second_approval"];

const URGENCY_RANK: Record<string, number> = { critical: 0, urgent: 1, normal: 2 };

export type QueueItem = {
  id: string;
  status: string;
  urgency?: string | null;
  submitted_at?: string | Date | null;
  approver?: { id: string } | null;
};

function time(v: string | Date | null | undefined): number {
  if (!v) return Number.MAX_SAFE_INTEGER;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/** Urgency (critical → urgent → normal), then oldest submission first, then id. */
export function compareQueue(a: QueueItem, b: QueueItem): number {
  const ua = URGENCY_RANK[a.urgency ?? ""] ?? 99;
  const ub = URGENCY_RANK[b.urgency ?? ""] ?? 99;
  if (ua !== ub) return ua - ub;
  const ta = time(a.submitted_at);
  const tb = time(b.submitted_at);
  if (ta !== tb) return ta - tb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortQueue<T extends QueueItem>(rows: T[]): T[] {
  return [...rows].sort(compareQueue);
}

/** Can this user decide the request right now? A first approver can't also be the second. */
export function isActionableBy(item: QueueItem, userId: string): boolean {
  if (item.status === "submitted") return true;
  if (item.status === "awaiting_second_approval") return item.approver?.id !== userId;
  return false;
}

export type ReviewPosition<T> = {
  prev: T | null;
  next: T | null;
  before: number;
  after: number;
};

/**
 * Previous / next actionable requests around `current`, by sort key — works even when
 * `current` has just been decided and is no longer pending.
 */
export function reviewPosition<T extends QueueItem>(rows: T[], current: QueueItem, userId: string): ReviewPosition<T> {
  const others = sortQueue(rows.filter((r) => r.id !== current.id && isActionableBy(r, userId)));
  const beforeList = others.filter((r) => compareQueue(r, current) < 0);
  const afterList = others.filter((r) => compareQueue(r, current) > 0);
  return {
    prev: beforeList.length ? beforeList[beforeList.length - 1] : null,
    next: afterList[0] ?? null,
    before: beforeList.length,
    after: afterList.length,
  };
}

/** `?review=<epoch ms>` → Date the review started; anything invalid/future → null. */
export function parseReviewStart(raw: string | string[] | undefined, now: number = Date.now()): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !/^\d{10,15}$/.test(v)) return null;
  const n = Number(v);
  if (n > now + 60_000) return null;
  return n;
}

export function reviewHref(id: string, start: number): string {
  return `/requests/${id}?review=${start}#decision`;
}

export function reviewDoneHref(start: number): string {
  return `/finance/queue/review-done?since=${start}`;
}
