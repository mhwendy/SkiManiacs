// expo-secure-store has no web implementation; web is a development target only.
export const secureStorage = {
  get: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  set: async (key: string, value: string) => {
    globalThis.localStorage?.setItem(key, value);
  },
  remove: async (key: string) => {
    globalThis.localStorage?.removeItem(key);
  },
};
