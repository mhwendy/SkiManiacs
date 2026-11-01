import Storage from 'expo-sqlite/kv-store';

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await Storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await Storage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best effort; the app keeps working from memory.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await Storage.removeItem(key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
