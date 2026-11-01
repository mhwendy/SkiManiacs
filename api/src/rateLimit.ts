export type RateLimiter = {
  // Returns true while the key is still allowed to proceed.
  allow(key: string): boolean;
  // Records one hit for the key.
  hit(key: string): void;
  reset(key: string): void;
};

type Entry = { count: number; resetAt: number };

// Fixed-window in-memory limiter. Per instance only; fine for a single small API.
export function createRateLimiter(
  max: number,
  windowMs: number,
  now: () => number = Date.now,
): RateLimiter {
  const entries = new Map<string, Entry>();

  const current = (key: string): Entry | undefined => {
    const entry = entries.get(key);
    if (entry && entry.resetAt <= now()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };

  const prune = () => {
    if (entries.size < 10_000) return;
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now()) entries.delete(key);
    }
  };

  return {
    allow: (key) => (current(key)?.count ?? 0) < max,
    hit: (key) => {
      const entry = current(key);
      if (entry) {
        entry.count += 1;
      } else {
        prune();
        entries.set(key, { count: 1, resetAt: now() + windowMs });
      }
    },
    reset: (key) => {
      entries.delete(key);
    },
  };
}
