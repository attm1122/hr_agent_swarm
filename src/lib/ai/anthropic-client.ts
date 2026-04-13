/**
 * Anthropic SDK singleton.
 * Reads ANTHROPIC_API_KEY at first use; throws a clear error if missing
 * so callers can surface a friendly "AI not configured" state.
 */

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super(
      'ANTHROPIC_API_KEY is not configured. Set it in environment variables to enable conversational AI.',
    );
    this.name = 'AnthropicNotConfiguredError';
  }
}

export function getAnthropicClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfiguredError();
  client = new Anthropic({ apiKey });
  return client;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Default model. Sonnet 4.5 is our reasoning workhorse:
 * best tool-use, long context, low hallucination on factual lookups.
 */
export const DEFAULT_MODEL = 'claude-sonnet-4-5';

/** Hard cap on tool-use loop iterations to prevent runaways. */
export const MAX_TOOL_ITERATIONS = 8;

/** Reasonable per-turn cap; enough for analysis but not unbounded. */
export const DEFAULT_MAX_TOKENS = 4096;
