import type { AiCostEstimate } from '@pm-os/types';

/**
 * Per-million-token pricing for Claude models.
 * Prices in USD. Updated for the models available as of early 2026.
 */
const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  'claude-sonnet-4-20250514': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'claude-haiku-4-20250414': { inputPerMillion: 0.8, outputPerMillion: 4.0 },
  'claude-opus-4-20250514': { inputPerMillion: 15.0, outputPerMillion: 75.0 },
};

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Tracks cumulative AI API costs and enforces spending limits.
 */
export class CostTracker {
  private records: AiCostEstimate[] = [];
  private limitUsd: number;

  constructor(limitUsd: number = Infinity) {
    this.limitUsd = limitUsd;
  }

  /**
   * Record a completed API call's cost.
   */
  record(estimate: AiCostEstimate): void {
    this.records.push(estimate);
  }

  /**
   * Total cost in USD across all recorded calls.
   */
  get totalCostUsd(): number {
    return this.records.reduce((sum, r) => sum + r.estimatedCostUsd, 0);
  }

  /**
   * Whether the cumulative cost has reached or exceeded the limit.
   */
  get isOverLimit(): boolean {
    return this.totalCostUsd >= this.limitUsd;
  }

  /**
   * Update the spending limit.
   */
  setLimit(limitUsd: number): void {
    this.limitUsd = limitUsd;
  }

  /**
   * Get the current spending limit.
   */
  getLimit(): number {
    return this.limitUsd;
  }

  /**
   * Number of API calls recorded.
   */
  get callCount(): number {
    return this.records.length;
  }

  /**
   * Reset all tracked costs.
   */
  reset(): void {
    this.records = [];
  }

  /**
   * Estimate the cost for a request before making it.
   */
  static estimate(inputTokens: number, outputTokens: number, model?: string): AiCostEstimate {
    const modelId = model ?? DEFAULT_MODEL;
    const pricing = MODEL_PRICING[modelId] ?? MODEL_PRICING[DEFAULT_MODEL];

    const estimatedCostUsd =
      (inputTokens / 1_000_000) * pricing.inputPerMillion +
      (outputTokens / 1_000_000) * pricing.outputPerMillion;

    return {
      inputTokens,
      outputTokens,
      model: modelId,
      estimatedCostUsd,
    };
  }
}
