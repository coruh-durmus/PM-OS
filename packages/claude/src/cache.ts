/**
 * LRU cache for AI summaries with TTL-based expiration.
 * Avoids re-summarizing unchanged content and reduces API costs.
 */
export class SummaryCache {
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(options?: { ttlMs?: number; maxSize?: number }) {
    this.ttlMs = options?.ttlMs ?? 5 * 60 * 1000; // default 5 minutes
    this.maxSize = options?.maxSize ?? 100;
  }

  /**
   * Retrieve a cached summary. Returns undefined if absent or expired.
   * Accessing an entry refreshes its position (most-recently-used).
   */
  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most-recently-used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  /**
   * Store a summary in the cache. Evicts the least-recently-used entry
   * if the cache is at capacity.
   */
  set(key: string, value: string): void {
    // If key already exists, delete it first so re-insert moves it to the end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict LRU (first entry in Map insertion order) if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value as string;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Check if a non-expired entry exists for the given key.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Remove a specific entry.
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Remove all entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Number of entries currently in the cache (including expired ones
   * that haven't been accessed yet).
   */
  get size(): number {
    return this.cache.size;
  }
}
