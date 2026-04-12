/**
 * OpenAI LLM Adapter - Production LLM integration
 */

import type {
  LLMProviderPort,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMEmbeddingRequest,
  LLMEmbeddingResponse,
} from '@/lib/ports/infrastructure-ports';
import OpenAI from 'openai';

export class OpenAIAdapter implements LLMProviderPort {
  private client: OpenAI;
  private defaultModel: string;
  private embeddingModel: string;

  constructor(config: {
    apiKey: string;
    defaultModel?: string;
    embeddingModel?: string;
    baseURL?: string;
  }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.defaultModel = config.defaultModel || 'gpt-4-turbo-preview';
    this.embeddingModel = config.embeddingModel || 'text-embedding-3-small';
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const startTime = Date.now();
    
    try {
      const completion = await this.client.chat.completions.create({
        model: request.model || this.defaultModel,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        tools: request.tools?.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
      });

      const message = completion.choices[0]?.message;
      
      return {
        content: message?.content || '',
        toolCalls: message?.tool_calls?.map(tc => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        finishReason: completion.choices[0]?.finish_reason || 'unknown',
      };
    } catch (error) {
      console.error('OpenAI completion error:', error);
      throw new Error(`LLM completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embed(request: LLMEmbeddingRequest): Promise<LLMEmbeddingResponse> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    
    try {
      const response = await this.client.embeddings.create({
        model: request.model || this.embeddingModel,
        input: inputs,
      });

      return {
        embeddings: response.data.map(d => d.embedding),
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          totalTokens: response.usage?.prompt_tokens || 0,
        },
      };
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw new Error(`Embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async health(): Promise<{ healthy: boolean; latency: number }> {
    const startTime = Date.now();
    
    try {
      // Simple models list check
      await this.client.models.list();
      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch {
      return {
        healthy: false,
        latency: Date.now() - startTime,
      };
    }
  }

  async listModels(): Promise<string[]> {
    const response = await this.client.models.list();
    return response.data.map(m => m.id);
  }
}

// Factory
export function createLLMAdapter(): LLMProviderPort | null {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not configured, LLM features disabled');
    return null;
  }
  
  return new OpenAIAdapter({
    apiKey,
    defaultModel: process.env.OPENAI_DEFAULT_MODEL,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL,
  });
}
