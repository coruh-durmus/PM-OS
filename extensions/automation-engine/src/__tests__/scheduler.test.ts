import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { matchesCron, Scheduler } from '../scheduler.js';
import type { AutomationConfig } from '../scheduler.js';

/* ------------------------------------------------------------------ */
/*  matchesCron unit tests                                            */
/* ------------------------------------------------------------------ */

describe('matchesCron', () => {
  it('matches "* * * * *" against any date (always)', () => {
    expect(matchesCron('* * * * *', new Date(2026, 0, 1, 0, 0))).toBe(true);
    expect(matchesCron('* * * * *', new Date(2026, 5, 15, 14, 30))).toBe(true);
    expect(matchesCron('* * * * *', new Date(2026, 11, 31, 23, 59))).toBe(true);
  });

  it('matches "0 9 * * 1-5" for weekday 9:00 AM', () => {
    // 2026-04-13 is a Monday (day-of-week = 1)
    const mondayAt9 = new Date(2026, 3, 13, 9, 0);
    expect(matchesCron('0 9 * * 1-5', mondayAt9)).toBe(true);

    // 2026-04-17 is a Friday (day-of-week = 5)
    const fridayAt9 = new Date(2026, 3, 17, 9, 0);
    expect(matchesCron('0 9 * * 1-5', fridayAt9)).toBe(true);
  });

  it('rejects mismatched times', () => {
    // Saturday at 9:00 AM -- day-of-week 6, outside 1-5
    const saturdayAt9 = new Date(2026, 3, 11, 9, 0);
    expect(matchesCron('0 9 * * 1-5', saturdayAt9)).toBe(false);

    // Monday at 10:00 AM -- hour doesn't match
    const mondayAt10 = new Date(2026, 3, 13, 10, 0);
    expect(matchesCron('0 9 * * 1-5', mondayAt10)).toBe(false);

    // Monday at 9:15 AM -- minute doesn't match
    const mondayAt915 = new Date(2026, 3, 13, 9, 15);
    expect(matchesCron('0 9 * * 1-5', mondayAt915)).toBe(false);
  });

  it('handles comma-separated lists', () => {
    // "30 8,12,17 * * *" -- at minute 30 of hours 8, 12, 17
    expect(matchesCron('30 8,12,17 * * *', new Date(2026, 0, 1, 12, 30))).toBe(true);
    expect(matchesCron('30 8,12,17 * * *', new Date(2026, 0, 1, 10, 30))).toBe(false);
  });

  it('returns false for empty or malformed expressions', () => {
    expect(matchesCron('', new Date())).toBe(false);
    expect(matchesCron('   ', new Date())).toBe(false);
    expect(matchesCron('0 9', new Date())).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Scheduler integration tests                                       */
/* ------------------------------------------------------------------ */

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new Scheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('fires handler when schedule matches', () => {
    const handler = vi.fn();
    const config: AutomationConfig = {
      id: 'test-always',
      name: 'Always fires',
      schedule: '* * * * *',
      actions: [],
      enabled: true,
    };

    scheduler.register(config, handler);
    scheduler.start();

    // Advance 30 seconds to trigger the first tick
    vi.advanceTimersByTime(30_000);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(config);
  });

  it('does not fire disabled automations', () => {
    const handler = vi.fn();
    const config: AutomationConfig = {
      id: 'test-disabled',
      name: 'Disabled',
      schedule: '* * * * *',
      actions: [],
      enabled: false,
    };

    scheduler.register(config, handler);
    scheduler.start();

    vi.advanceTimersByTime(30_000);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire when schedule does not match', () => {
    const handler = vi.fn();
    const config: AutomationConfig = {
      id: 'test-nomatch',
      name: 'No match',
      // Minute 59, hour 23, day 31 -- very specific
      schedule: '59 23 31 12 *',
      actions: [],
      enabled: true,
    };

    // Set system time to a moment that will not match
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0));
    scheduler.register(config, handler);
    scheduler.start();

    vi.advanceTimersByTime(30_000);

    expect(handler).not.toHaveBeenCalled();
  });

  it('fires at most once per minute even with multiple ticks', () => {
    const handler = vi.fn();
    const config: AutomationConfig = {
      id: 'test-dedup',
      name: 'Dedup test',
      schedule: '* * * * *',
      actions: [],
      enabled: true,
    };

    scheduler.register(config, handler);

    // Manually tick twice for the same minute
    const now = new Date(2026, 3, 13, 9, 0, 0);
    scheduler.tick(now);
    scheduler.tick(now);

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
