export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = globalThis.localStorage?.getItem(key) ?? null;
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best effort; the app keeps working from memory.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
