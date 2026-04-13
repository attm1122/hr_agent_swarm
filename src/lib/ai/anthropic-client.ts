/**
 * Anthropic SDK singleton.
 *
 * Supports two auth paths:
 *   1. Direct Anthropic API  (ANTHROPIC_API_KEY = sk-ant-...)
 *   2. Vercel AI Gateway     (AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY = vck_...,
 *                             optional ANTHROPIC_BASE_URL = https://ai-gateway.vercel.sh)
 *
 * The Vercel AI Gateway implements the Anthropic Messages API spec, so the
 * native @anthropic-ai/sdk works unchanged once the base URL is pointed at
 * it. When routing through the gateway, model IDs must be namespace-prefixed
 * (e.g. `anthropic/claude-sonnet-4-5`) — we detect this automatically based
 * on the key format.
 */

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super(
      'No AI credentials configured. Set ANTHROPIC_API_KEY (or AI_GATEWAY_API_KEY) to enable conversational AI.',
    );
    this.name = 'AnthropicNotConfiguredError';
  }
}

/** Prefer the explicit gateway key, fall back to the generic Anthropic key. */
function getApiKey(): string | undefined {
  return (
    process.env.AI_GATEWAY_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    undefined
  );
}

/** AI Gateway keys start with `vck_`. Everything else is a direct Anthropic key. */
function isGatewayKey(key: string): boolean {
  return key.startsWith('vck_');
}

/** Resolve the base URL based on explicit env or key type. */
function getBaseURL(key: string): string | undefined {
  if (process.env.ANTHROPIC_BASE_URL) return process.env.ANTHROPIC_BASE_URL;
  if (isGatewayKey(key)) return 'https://ai-gateway.vercel.sh';
  return undefined; // let SDK default to https://api.anthropic.com
}

export function getAnthropicClient(): Anthropic {
  if (client) return client;
  const apiKey = getApiKey();
  if (!apiKey) throw new AnthropicNotConfiguredError();
  const baseURL = getBaseURL(apiKey);
  client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
  return client;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(getApiKey());
}

/**
 * Whether we're routing through Vercel AI Gateway (affects model prefix).
 */
export function isUsingGateway(): boolean {
  const key = getApiKey();
  if (!key) return false;
  if (process.env.ANTHROPIC_BASE_URL?.includes('ai-gateway.vercel.sh')) {
    return true;
  }
  return isGatewayKey(key);
}

/**
 * Resolve the provider-qualified model ID.
 * Gateway requires `anthropic/` prefix; direct API does not accept it.
 */
export function resolveModelId(baseModel: string): string {
  if (isUsingGateway()) {
    return baseModel.startsWith('anthropic/')
      ? baseModel
      : `anthropic/${baseModel}`;
  }
  return baseModel.replace(/^anthropic\//, '');
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
