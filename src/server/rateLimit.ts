/**
 * In-memory rate limit per client key (IP). Good enough for local development and a single
 * server instance; it resets on restart and isn't shared between instances. Per-user quotas
 * move to Postgres (consume_ai_quota) once accounts exist.
 */
const PER_MINUTE = 12;
const PER_DAY = 150;

type Bucket = { minuteStart: number; minuteCount: number; dayStart: number; dayCount: number };
const buckets = new Map<string, Bucket>();

export function takeToken(key: string, now = Date.now()): boolean {
  const b = buckets.get(key) ?? { minuteStart: now, minuteCount: 0, dayStart: now, dayCount: 0 };
  if (now - b.minuteStart >= 60_000) {
    b.minuteStart = now;
    b.minuteCount = 0;
  }
  if (now - b.dayStart >= 86_400_000) {
    b.dayStart = now;
    b.dayCount = 0;
  }
  if (b.minuteCount >= PER_MINUTE || b.dayCount >= PER_DAY) {
    buckets.set(key, b);
    return false;
  }
  b.minuteCount += 1;
  b.dayCount += 1;
  buckets.set(key, b);
  return true;
}

export function clientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}
