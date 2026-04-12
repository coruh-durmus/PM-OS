/**
 * Request to summarize content from a panel (Slack channel, Notion page, web article).
 */
export interface AiSummaryRequest {
  panelId: string;
  contentType: 'slack-channel' | 'slack-thread' | 'notion-page' | 'web-article';
  content: string;
  maxTokens?: number;
}

/**
 * Request to draft content (PRD, status update, reply, etc.).
 */
export interface AiDraftRequest {
  draftType: 'prd' | 'status-update' | 'slack-reply' | 'meeting-notes' | 'custom';
  context: string;
  instructions?: string;
  maxTokens?: number;
}

/**
 * A single message in an AI chat conversation.
 */
export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Estimated cost for an AI API call, used for budget tracking.
 */
export interface AiCostEstimate {
  inputTokens: number;
  outputTokens: number;
  model: string;
  estimatedCostUsd: number;
}

/**
 * Configuration options for the shared Claude client.
 */
export interface ClaudeClientOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  costLimitUsd?: number;
}
