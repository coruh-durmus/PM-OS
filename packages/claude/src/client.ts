import Anthropic from '@anthropic-ai/sdk';
import type { ClaudeClientOptions } from '@pm-os/types';
import { SummaryCache } from './cache.js';
import { CostTracker } from './cost.js';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Shared Claude API client for PM-OS.
 *
 * Wraps the Anthropic SDK with:
 * - Summary caching (avoid duplicate API calls for unchanged content)
 * - Cost tracking (estimate and record spend, enforce limits)
 * - Streaming support
 */
export class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  readonly cache: SummaryCache;
  readonly costs: CostTracker;

  constructor(options: ClaudeClientOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.cache = new SummaryCache();
    this.costs = new CostTracker(options.costLimitUsd);
  }

  /**
   * Send a non-streaming completion request.
   *
   * If a `cacheKey` is provided and a cached result exists, the cached
   * value is returned without making an API call.
   */
  async complete(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: { system?: string; maxTokens?: number; cacheKey?: string },
  ): Promise<string> {
    // Check cache first
    if (options?.cacheKey) {
      const cached = this.cache.get(options.cacheKey);
      if (cached) return cached;
    }

    // Enforce cost limit
    if (this.costs.isOverLimit) {
      throw new Error(
        `Cost limit exceeded: $${this.costs.totalCostUsd.toFixed(4)} >= $${this.costs.getLimit()}`,
      );
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? this.maxTokens,
      system: options?.system,
      messages,
    });

    // Extract text content
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Track cost
    const estimate = CostTracker.estimate(
      response.usage.input_tokens,
      response.usage.output_tokens,
      this.model,
    );
    this.costs.record(estimate);

    // Cache if a key was provided
    if (options?.cacheKey) {
      this.cache.set(options.cacheKey, text);
    }

    return text;
  }

  /**
   * Send a streaming completion request. Yields text deltas as they arrive.
   */
  async *stream(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: { system?: string; maxTokens?: number },
  ): AsyncGenerator<string, void, unknown> {
    // Enforce cost limit
    if (this.costs.isOverLimit) {
      throw new Error(
        `Cost limit exceeded: $${this.costs.totalCostUsd.toFixed(4)} >= $${this.costs.getLimit()}`,
      );
    }

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: options?.maxTokens ?? this.maxTokens,
      system: options?.system,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }

    // Track cost from the final message
    const finalMessage = await stream.finalMessage();
    const estimate = CostTracker.estimate(
      finalMessage.usage.input_tokens,
      finalMessage.usage.output_tokens,
      this.model,
    );
    this.costs.record(estimate);
  }
}
