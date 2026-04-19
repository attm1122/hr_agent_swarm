const store = new Map<string, { value: string; expiresAt: number }>();

export function getKvStore() {
  return {
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async deleteByPrefix(prefix: string): Promise<void> {
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) store.delete(k);
      }
    },
  };
}
