/**
 * GET    /api/chat/:conversationId  - full message history for a thread
 * DELETE /api/chat/:conversationId  - delete thread + messages
 *
 * Both scoped to the current user; RLS enforces the same rule at the DB.
 */

import { NextRequest } from 'next/server';
import { requireResolvedSession } from '@/lib/auth/session';
import { getConversationStore } from '@/lib/ai/conversation-store';

export const runtime = 'nodejs';

function jsonError(message: string, code: string, status: number) {
  return new Response(
    JSON.stringify({ error: { message, code } }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;

  let session;
  try {
    session = await requireResolvedSession();
  } catch {
    return jsonError('Authentication required', 'AUTH_REQUIRED', 401);
  }

  const tenantId = session.tenantId || 'default';
  const store = getConversationStore();
  const conversation = await store.getConversation(
    conversationId,
    session.userId,
    tenantId,
  );
  if (!conversation) {
    return jsonError('Conversation not found', 'NOT_FOUND', 404);
  }

  const messages = await store.listMessages(conversationId, tenantId);
  return new Response(
    JSON.stringify({ conversation, messages }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;

  let session;
  try {
    session = await requireResolvedSession();
  } catch {
    return jsonError('Authentication required', 'AUTH_REQUIRED', 401);
  }

  const tenantId = session.tenantId || 'default';
  const store = getConversationStore();
  await store.deleteConversation(conversationId, session.userId, tenantId);
  return new Response(null, { status: 204 });
}
