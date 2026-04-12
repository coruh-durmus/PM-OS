import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SummaryCache } from '../cache.js';

describe('SummaryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    const cache = new SummaryCache();
    cache.set('key1', 'summary of #general');

    expect(cache.get('key1')).toBe('summary of #general');
    expect(cache.has('key1')).toBe(true);
  });

  it('returns undefined for expired entries', () => {
    const cache = new SummaryCache({ ttlMs: 1000 });
    cache.set('key1', 'short-lived summary');

    // Advance time past TTL
    vi.advanceTimersByTime(1500);

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.has('key1')).toBe(false);
  });

  it('evicts the least-recently-used entry when at capacity', () => {
    const cache = new SummaryCache({ maxSize: 3 });

    cache.set('a', 'summary-a');
    cache.set('b', 'summary-b');
    cache.set('c', 'summary-c');

    // Access 'a' to make it most-recently-used
    cache.get('a');

    // Insert a fourth entry — should evict 'b' (the LRU)
    cache.set('d', 'summary-d');

    expect(cache.get('a')).toBe('summary-a');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('summary-c');
    expect(cache.get('d')).toBe('summary-d');
    expect(cache.size).toBe(3);
  });

  it('clear removes all entries', () => {
    const cache = new SummaryCache();
    cache.set('x', 'val-x');
    cache.set('y', 'val-y');

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('x')).toBeUndefined();
    expect(cache.get('y')).toBeUndefined();
  });
});
