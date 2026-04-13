/**
 * Infrastructure Ports - Interfaces for external services
 */

// ============================================================================
// Cache Port (for Redis or similar)
// ============================================================================

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  increment(key: string, amount?: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  
  // Rate limiting helpers
  rateLimitCheck(key: string, maxRequests: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }>;
  
  // CSRF token storage
  storeCsrfToken(sessionId: string, token: string, ttlSeconds: number): Promise<void>;
  validateCsrfToken(sessionId: string, token: string): Promise<boolean>;
  revokeCsrfToken(sessionId: string): Promise<void>;
}

// ============================================================================
// LLM Provider Port
// ============================================================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

export interface LLMCompletionResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface LLMEmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface LLMEmbeddingResponse {
  embeddings: number[][];
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

export interface LLMProviderPort {
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  embed(request: LLMEmbeddingRequest): Promise<LLMEmbeddingResponse>;
  
  // Health check
  health(): Promise<{ healthy: boolean; latency: number }>;
  
  // Model management
  listModels(): Promise<string[]>;
}

// ============================================================================
// Audit Log Port
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  userId: string;
  role: string;
  sessionId: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  integrityHash: string;
  previousHash?: string;
}

export interface AuditLogPort {
  log(entry: AuditLogEntry): Promise<void>;
  query(params: {
    tenantId: string;
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]>;
  verifyIntegrity(tenantId: string, startDate?: string, endDate?: string): Promise<{
    valid: boolean;
    tamperedEntries?: string[];
  }>;
}

// ============================================================================
// Search/Vector Port
// ============================================================================

export interface VectorSearchRequest {
  vector: number[];
  topK: number;
  filters?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface SearchPort {
  // Vector search
  vectorSearch(request: VectorSearchRequest): Promise<VectorSearchResult[]>;
  
  // Full-text search
  textSearch(query: string, options?: {
    fields?: string[];
    filters?: Record<string, unknown>;
    limit?: number;
  }): Promise<Array<{ id: string; score: number; highlights: string[] }>>;
  
  // Hybrid search
  hybridSearch(vector: number[], textQuery: string, options?: {
    vectorWeight?: number;
    textWeight?: number;
    limit?: number;
  }): Promise<VectorSearchResult[]>;
  
  // Index management
  indexDocument(id: string, content: string, metadata: Record<string, unknown>): Promise<void>;
  indexVector(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void>;
  deleteDocument(id: string): Promise<void>;
}

// ============================================================================
// File Storage Port
// ============================================================================

export interface FileStoragePort {
  upload(params: {
    key: string;
    content: Buffer | ReadableStream;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<{ url: string; etag: string }>;
  
  download(key: string): Promise<{
    content: Buffer;
    contentType: string;
    metadata: Record<string, string>;
  }>;
  
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  
  delete(key: string): Promise<void>;
  
  exists(key: string): Promise<boolean>;
}

// ============================================================================
// Notification Port
// ============================================================================

export interface NotificationPort {
  sendEmail(params: {
    to: string | string[];
    subject: string;
    body: string;
    html?: string;
    attachments?: Array<{ filename: string; content: Buffer }>;
  }): Promise<void>;
  
  sendSlack(params: {
    channel: string;
    message: string;
    blocks?: unknown[];
  }): Promise<void>;
  
  sendInApp(params: {
    userId: string;
    title: string;
    message: string;
    actionUrl?: string;
  }): Promise<void>;
}
