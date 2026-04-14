/**
 * Conversation Persistence
 *
 * Reads/writes `conversations` + `chat_messages` in Supabase. All access is
 * scoped by (tenant_id, user_id) — RLS on the tables is the final safety
 * net, but we also enforce it here so mock-mode (no service role client)
 * behaves identically.
 *
 * Schema (see `supabase/migrations/*conversational_ai*.sql`):
 *
 *   conversations(
 *     id uuid pk,
 *     tenant_id uuid,
 *     user_id uuid,
 *     employee_id uuid,
 *     title text,
 *     last_message_at timestamptz,
 *     metadata jsonb,
 *     created_at timestamptz,
 *     updated_at timestamptz
 *   )
 *
 *   chat_messages(
 *     id uuid pk,
 *     conversation_id uuid fk -> conversations.id,
 *     tenant_id uuid,
 *     role text check ('user' | 'assistant'),
 *     content jsonb,           -- Anthropic content-block array
 *     tool_calls jsonb,        -- optional array of ToolCallTrace
 *     usage jsonb,             -- optional { input_tokens, output_tokens }
 *     created_at timestamptz
 *   )
 *
 * When the service role client isn't configured (dev / mock mode) we fall
 * back to an in-memory ring buffer so the chat UI still works for
 * stakeholder previews.
 */
/* eslint-disable no-console */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/repositories/agent-run-repository';
import type { ChatTurn, ToolCallTrace } from './orchestrator';

export interface Conversation {
  id: string;
  tenantId: string;
  userId: string;
  employeeId: string | null;
  title: string;
  lastMessageAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  tenantId: string;
  role: 'user' | 'assistant';
  content: ChatTurn['content'];
  toolCalls?: ToolCallTrace[];
  usage?: { inputTokens: number; outputTokens: number };
  createdAt: string;
}

export interface CreateConversationInput {
  tenantId: string;
  userId: string;
  employeeId?: string | null;
  title?: string;
}

export interface AppendMessageInput {
  conversationId: string;
  tenantId: string;
  role: 'user' | 'assistant';
  content: ChatTurn['content'];
  toolCalls?: ToolCallTrace[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ConversationStore {
  readonly backend: 'supabase' | 'memory';

  listConversations(userId: string, tenantId: string): Promise<Conversation[]>;
  getConversation(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<Conversation | null>;
  createConversation(input: CreateConversationInput): Promise<Conversation>;
  renameConversation(
    id: string,
    userId: string,
    tenantId: string,
    title: string,
  ): Promise<void>;
  deleteConversation(id: string, userId: string, tenantId: string): Promise<void>;

  listMessages(
    conversationId: string,
    tenantId: string,
    userId?: string,
  ): Promise<ChatMessage[]>;
  appendMessage(input: AppendMessageInput): Promise<ChatMessage>;
}

/* -------------------------------------------------------------------------- */
/*  Supabase-backed implementation                                            */
/* -------------------------------------------------------------------------- */

class SupabaseConversationStore implements ConversationStore {
  readonly backend = 'supabase' as const;
  constructor(private client: SupabaseClient) {}

  async listConversations(userId: string, tenantId: string): Promise<Conversation[]> {
    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(`Failed to list conversations: ${error.message}`);
    return (data ?? []).map(rowToConversation);
  }

  async getConversation(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<Conversation | null> {
    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to get conversation: ${error.message}`);
    return data ? rowToConversation(data) : null;
  }

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    const payload = {
      tenant_id: input.tenantId,
      user_id: input.userId,
      employee_id: input.employeeId ?? null,
      title: input.title ?? 'New conversation',
      last_message_at: now,
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await this.client
      .from('conversations')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create conversation: ${error.message}`);
    return rowToConversation(data);
  }

  async renameConversation(
    id: string,
    userId: string,
    tenantId: string,
    title: string,
  ): Promise<void> {
    const { error } = await this.client
      .from('conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to rename conversation: ${error.message}`);
  }

  async deleteConversation(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const { error } = await this.client
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
  }

  async listMessages(
    conversationId: string,
    tenantId: string,
    userId?: string,
  ): Promise<ChatMessage[]> {
    // SECURITY: When userId is provided, verify conversation ownership
    // before returning messages. This is defense-in-depth alongside RLS.
    if (userId) {
      const { data: convo } = await this.client
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!convo) return []; // Conversation doesn't belong to this user
    }

    const { data, error } = await this.client
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to list messages: ${error.message}`);
    return (data ?? []).map(rowToMessage);
  }

  async appendMessage(input: AppendMessageInput): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const payload = {
      conversation_id: input.conversationId,
      tenant_id: input.tenantId,
      role: input.role,
      content: input.content,
      tool_calls: input.toolCalls ?? null,
      usage: input.usage ?? null,
      created_at: now,
    };

    const { data, error } = await this.client
      .from('chat_messages')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to append message: ${error.message}`);

    // Bump last_message_at so the conversation list sorts correctly.
    await this.client
      .from('conversations')
      .update({ last_message_at: now, updated_at: now })
      .eq('id', input.conversationId)
      .eq('tenant_id', input.tenantId);

    return rowToMessage(data);
  }
}

interface ConversationRow {
  id: string;
  tenant_id: string;
  user_id: string;
  employee_id: string | null;
  title: string;
  last_message_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessageRow {
  id: string;
  conversation_id: string;
  tenant_id: string;
  role: 'user' | 'assistant';
  content: ChatTurn['content'];
  tool_calls: ToolCallTrace[] | null;
  usage: { input_tokens: number; output_tokens: number } | null;
  created_at: string;
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    employeeId: row.employee_id,
    title: row.title,
    lastMessageAt: row.last_message_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    tenantId: row.tenant_id,
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls ?? undefined,
    usage: row.usage
      ? { inputTokens: row.usage.input_tokens, outputTokens: row.usage.output_tokens }
      : undefined,
    createdAt: row.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/*  In-memory fallback                                                        */
/*  Used for dev/mock mode so the chat UI stays functional without Supabase.  */
/* -------------------------------------------------------------------------- */

class MemoryConversationStore implements ConversationStore {
  readonly backend = 'memory' as const;
  private conversations = new Map<string, Conversation>();
  private messages = new Map<string, ChatMessage[]>();

  async listConversations(userId: string, tenantId: string): Promise<Conversation[]> {
    return [...this.conversations.values()]
      .filter((c) => c.userId === userId && c.tenantId === tenantId)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }

  async getConversation(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<Conversation | null> {
    const c = this.conversations.get(id);
    if (!c || c.userId !== userId || c.tenantId !== tenantId) return null;
    return c;
  }

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    const convo: Conversation = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      userId: input.userId,
      employeeId: input.employeeId ?? null,
      title: input.title ?? 'New conversation',
      lastMessageAt: now,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(convo.id, convo);
    this.messages.set(convo.id, []);
    return convo;
  }

  async renameConversation(
    id: string,
    userId: string,
    tenantId: string,
    title: string,
  ): Promise<void> {
    const c = await this.getConversation(id, userId, tenantId);
    if (!c) return;
    c.title = title;
    c.updatedAt = new Date().toISOString();
  }

  async deleteConversation(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const c = await this.getConversation(id, userId, tenantId);
    if (!c) return;
    this.conversations.delete(id);
    this.messages.delete(id);
  }

  async listMessages(
    conversationId: string,
    tenantId: string,
    userId?: string,
  ): Promise<ChatMessage[]> {
    // SECURITY: Verify conversation ownership in memory store too
    if (userId) {
      const convo = this.conversations.get(conversationId);
      if (!convo || convo.userId !== userId || convo.tenantId !== tenantId) return [];
    }
    const list = this.messages.get(conversationId) ?? [];
    return list.filter((m) => m.tenantId === tenantId);
  }

  async appendMessage(input: AppendMessageInput): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      role: input.role,
      content: input.content,
      toolCalls: input.toolCalls,
      usage: input.usage,
      createdAt: now,
    };
    const list = this.messages.get(input.conversationId) ?? [];
    list.push(msg);
    this.messages.set(input.conversationId, list);

    const convo = this.conversations.get(input.conversationId);
    if (convo) {
      convo.lastMessageAt = now;
      convo.updatedAt = now;
    }
    return msg;
  }
}

/* -------------------------------------------------------------------------- */
/*  Factory                                                                   */
/* -------------------------------------------------------------------------- */

let cached: ConversationStore | null = null;

export function getConversationStore(): ConversationStore {
  if (cached) return cached;
  const client = createServiceRoleClient();
  if (client) {
    cached = new SupabaseConversationStore(client);
  } else {
    if (process.env.NODE_ENV === 'production') {
      // SECURITY: In production, missing service role key means conversations
      // silently disappear. Log as ERROR (not warn) so monitoring picks it up.
      console.error(
        '[CRITICAL] conversation-store: SUPABASE_SERVICE_ROLE_KEY not set in production. ' +
        'Conversations will NOT persist. This is a data loss condition. ' +
        'Set SUPABASE_SERVICE_ROLE_KEY to fix.',
      );
    }
    cached = new MemoryConversationStore();
  }
  return cached;
}

/** Convert stored messages back into the turn format the orchestrator expects. */
export function messagesToTurns(messages: ChatMessage[]): ChatTurn[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}
