type LruCache<TValue> = {
  get: (key: string) => TValue | undefined;
  set: (key: string, value: TValue) => void;
};

export const stableSerialize = (value: unknown): string => {
  if (value === undefined) {
    return '"__undefined__"';
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "number") {
    return Number.isNaN(value) ? '"__nan__"' : JSON.stringify(value);
  }
  if (typeof value === "bigint") {
    return `{"$bigint":"${value.toString()}"}`;
  }
  if (typeof value === "function") {
    return '"__function__"';
  }
  if (typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  const entries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const serialized = entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
    .join(",");
  return `{${serialized}}`;
};

export const createLruCache = <TValue>(capacity: number): LruCache<TValue> => {
  const size = Math.max(1, capacity);
  const cache = new Map<string, TValue>();

  const get = (key: string): TValue | undefined => {
    const found = cache.get(key);
    if (found === undefined) {
      return undefined;
    }
    cache.delete(key);
    cache.set(key, found);
    return found;
  };

  const set = (key: string, value: TValue): void => {
    if (cache.has(key)) {
      cache.delete(key);
    }
    cache.set(key, value);
    if (cache.size > size) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }
  };

  return { get, set };
};
