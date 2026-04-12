import { describe, it, expect } from 'vitest';
import { CostTracker } from '../cost.js';

describe('CostTracker', () => {
  it('tracks cumulative cost across multiple calls', () => {
    const tracker = new CostTracker();

    const est1 = CostTracker.estimate(1000, 500, 'claude-sonnet-4-20250514');
    tracker.record(est1);

    const est2 = CostTracker.estimate(2000, 1000, 'claude-sonnet-4-20250514');
    tracker.record(est2);

    // (1000/1M * 3) + (500/1M * 15) + (2000/1M * 3) + (1000/1M * 15)
    // = 0.003 + 0.0075 + 0.006 + 0.015 = 0.0315
    expect(tracker.totalCostUsd).toBeCloseTo(0.0315, 6);
    expect(tracker.callCount).toBe(2);
  });

  it('detects when cost exceeds the limit', () => {
    const tracker = new CostTracker(0.01);

    // This call costs: (10000/1M * 3) + (5000/1M * 15) = 0.03 + 0.075 = 0.105
    const expensive = CostTracker.estimate(10_000, 5_000, 'claude-sonnet-4-20250514');
    tracker.record(expensive);

    expect(tracker.isOverLimit).toBe(true);
  });

  it('estimate produces correct values for known models', () => {
    const est = CostTracker.estimate(1_000_000, 1_000_000, 'claude-haiku-4-20250414');

    // haiku: 0.80 per million input + 4.00 per million output
    expect(est.estimatedCostUsd).toBeCloseTo(4.8, 4);
    expect(est.model).toBe('claude-haiku-4-20250414');
    expect(est.inputTokens).toBe(1_000_000);
    expect(est.outputTokens).toBe(1_000_000);
  });
});
