'use client';

/**
 * Main chat UI.
 *
 * Responsibilities:
 * - List the user's conversations (left rail)
 * - Render the active thread's messages (center)
 * - Accept user input and POST to /api/chat, streaming events back
 *
 * Streaming contract: /api/chat returns `text/event-stream` with each event
 * a JSON-encoded `ServerEvent`. We parse lines starting with `data:`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationList } from './ConversationList';
import { MessageBubble } from './MessageBubble';
import type {
  ClientConversation,
  ClientMessage,
  ClientToolCall,
  ServerEvent,
  StoredMessage,
} from './types';
import { storedToClientMessage } from './types';

const SUGGESTIONS = [
  'Give me a snapshot of what I need to know right now.',
  'Which employees have expiring documents in the next 30 days?',
  'What does the handbook say about parental leave?',
  'Who on my team has pending leave requests?',
];

export function ChatWorkspace() {
  const [conversations, setConversations] = useState<ClientConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- load conversations on mount ---------------------------------------
  useEffect(() => {
    void refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshConversations() {
    setLoadingList(true);
    try {
      const res = await fetch('/api/chat', { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { conversations: ClientConversation[] };
      setConversations(body.conversations);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoadingList(false);
    }
  }

  // ---- load messages when active conversation changes --------------------
  const loadMessages = useCallback(async (id: string) => {
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/chat/${id}`, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { messages: StoredMessage[] };
      const rendered = body.messages
        .map(storedToClientMessage)
        .filter((m): m is ClientMessage => m !== null);
      setMessages(rendered);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) {
      void loadMessages(activeId);
    } else {
      setMessages([]);
    }
  }, [activeId, loadMessages]);

  // ---- scroll to bottom when messages change -----------------------------
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ---- handlers ----------------------------------------------------------
  function handleNew() {
    if (sending) return;
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/chat/${id}`, { method: 'DELETE' });
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      await refreshConversations();
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  }

  async function handleSend(messageOverride?: string) {
    const text = (messageOverride ?? input).trim();
    if (!text || sending) return;
    setError(null);
    setInput('');

    // Optimistic user bubble + pending assistant slot
    const userMsg: ClientMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      text,
      toolCalls: [],
    };
    const assistantMsg: ClientMessage = {
      id: `local-asst-${Date.now()}`,
      role: 'assistant',
      text: '',
      toolCalls: [],
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setSending(true);

    const abort = new AbortController();
    abortRef.current = abort;

    let receivedText = '';
    const receivedCalls: ClientToolCall[] = [];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: abort.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: activeId }),
      });

      if (!res.ok || !res.body) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(
          errorBody?.error?.message ?? `Server returned ${res.status}`,
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on blank-line event boundaries. SSE events are `data: {...}\n\n`
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const line = chunk.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;

          let ev: ServerEvent;
          try {
            ev = JSON.parse(payload) as ServerEvent;
          } catch {
            continue;
          }

          if (ev.type === 'meta') {
            // New thread; make it active and refresh sidebar.
            if (ev.conversationId !== activeId) {
              setActiveId(ev.conversationId);
              void refreshConversations();
            }
          } else if (ev.type === 'tool_call') {
            receivedCalls.push(ev.trace);
            updateLastAssistant({ toolCalls: [...receivedCalls] });
          } else if (ev.type === 'assistant_text') {
            receivedText = ev.text;
            updateLastAssistant({ text: receivedText });
          } else if (ev.type === 'error') {
            setError(ev.message);
          } else if (ev.type === 'done') {
            updateLastAssistant({ pending: false });
          }
        }
      }

      updateLastAssistant({ pending: false });
      void refreshConversations();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('Chat request failed', err);
      setError(
        err instanceof Error ? err.message : 'Something went wrong.',
      );
      updateLastAssistant({
        pending: false,
        text: receivedText ||
          'Sorry, something went wrong processing that request.',
      });
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function updateLastAssistant(patch: Partial<ClientMessage>) {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === 'assistant') {
          next[i] = { ...next[i], ...patch };
          break;
        }
      }
      return next;
    });
  }

  const showWelcome = !activeId && messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--muted-surface)]">
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => {
          if (!sending) setActiveId(id);
        }}
        onNew={handleNew}
        onDelete={handleDelete}
        loading={loadingList}
      />

      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-[var(--border-default)] bg-white px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              HR AI Assistant
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              Grounded in your HR data. Every action is audited.
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-6"
          aria-live="polite"
          aria-atomic="false"
          aria-relevant="additions"
        >
          {showWelcome ? (
            <WelcomeCard onPick={(s) => void handleSend(s)} />
          ) : loadingMessages ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading conversation...
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onFeedback={(id, type) => {
                    // TODO: send feedback to analytics/learning pipeline
                    console.log('[feedback]', { id, type });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="border-t border-[var(--danger-border)] bg-[var(--danger-bg)] px-5 py-2 text-xs text-[var(--danger-text)]"
          >
            {error}
          </div>
        )}

        <div className="border-t border-[var(--border-default)] bg-white p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="mx-auto flex max-w-3xl items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Ask about employees, leave, documents, policies..."
              rows={1}
              disabled={sending}
              className="min-h-[44px] max-h-40 flex-1 resize-none rounded-lg border border-[var(--border-default)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--primary)] text-white transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
          <div className="mx-auto mt-2 max-w-3xl text-[11px] text-[var(--text-disabled)]">
            Press Enter to send · Shift+Enter for a newline
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeCard({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl pt-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-white">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        What can I help you with?
      </h2>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">
        I have access to your employee directory, leave, documents, workflows,
        and policies. Ask in plain English.
      </p>

      <ScrollArea className="mt-6">
        <div className="grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-lg border border-[var(--border-default)] bg-white p-3 text-left text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--success-bg)]"
            >
              {s}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
