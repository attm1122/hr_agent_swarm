'use client';

/**
 * AssistantWorkspace — the AI-OS surface.
 *
 * Owns the prompt bar, the live SSE stream from /api/assistant, and the
 * dynamic block stream rendered via BlockRenderer. Action callbacks from
 * any block re-enter the same pipeline by re-submitting a new prompt.
 *
 * SSE event contract: see src/lib/ai-os/orchestrator/events.ts.
 */

import { useCallback, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import PromptBar from './PromptBar';
import IntentChip from './IntentChip';
import ModeChip from './ModeChip';
import BlockRenderer from './BlockRenderer';
import AuditTrail from './AuditTrail';
import ErrorBoundary from './ErrorBoundary';
import type {
  AiOsEvent,
  Intent,
  DecisionTrace,
  UIAction,
  UIBlock,
} from '@/lib/ai-os';
import type { ToolCallTrace } from '@/lib/ai/orchestrator';

interface RunState {
  intent?: Intent;
  decision?: DecisionTrace;
  blocks: UIBlock[];
  agentCalls: ToolCallTrace[];
  headline?: string;
  error?: string;
  status: 'idle' | 'streaming' | 'done' | 'error';
  rawInput?: string;
}

const EMPTY_RUN: RunState = {
  blocks: [],
  agentCalls: [],
  status: 'idle',
};

const SUGGESTIONS = [
  'Update my address to 14 Smith Street, Surry Hills NSW 2010',
  'What anniversaries are coming up next month? Send me a sheet.',
  'Can I terminate this probation employee?',
  'How many sick days do I have left?',
  'Show me my team',
];

export interface AssistantWorkspaceProps {
  /** Optional initial blocks to render before the first user prompt. */
  homeBlocks?: UIBlock[];
  /** Optional headline for the home (idle) state. */
  homeHeadline?: string;
}

export default function AssistantWorkspace({
  homeBlocks,
  homeHeadline,
}: AssistantWorkspaceProps) {
  const [run, setRun] = useState<RunState>(EMPTY_RUN);
  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(async (text: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRun({
      ...EMPTY_RUN,
      status: 'streaming',
      rawInput: text,
    });

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const friendlyMessages: Record<number, string> = {
          429: 'Too many requests. Please wait a moment and try again.',
          503: 'The AI service is temporarily unavailable. Your home workspace is still functional — try again in a moment.',
          401: 'Your session has expired. Please refresh the page.',
        };
        const errText =
          friendlyMessages[res.status] ??
          (await res.text().catch(() => 'Request failed'));
        setRun((r) => ({ ...r, status: 'error', error: errText }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try {
            const event = JSON.parse(json) as AiOsEvent;
            applyEvent(event);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[assistant] bad SSE frame', json, err);
          }
        }
      }

      setRun((r) => ({ ...r, status: 'done' }));
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setRun((r) => ({
        ...r,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  function applyEvent(event: AiOsEvent) {
    setRun((r) => {
      switch (event.kind) {
        case 'ready':
          return r;
        case 'intent_parsed':
          return { ...r, intent: event.intent };
        case 'decision':
          return { ...r, decision: event.trace };
        case 'agent_call':
          return { ...r, agentCalls: [...r.agentCalls, event.call] };
        case 'block':
          return { ...r, blocks: [...r.blocks, event.block] };
        case 'headline':
          return { ...r, headline: event.text };
        case 'artifact_ready':
          // Artifact also surfaces as a block via the composer; nothing to add here.
          return r;
        case 'clarification_required':
          return r;
        case 'done':
          return { ...r, status: 'done' };
        case 'error':
          return { ...r, status: 'error', error: event.message };
        default:
          return r;
      }
    });
  }

  const onAction = useCallback(
    (action: UIAction) => {
      if (action.href) {
        window.open(action.href, '_blank', 'noopener,noreferrer');
        return;
      }
      if (action.intent?.rawInput) {
        if (action.confirmCopy && !window.confirm(action.confirmCopy)) return;
        submit(action.intent.rawInput);
      }
    },
    [submit],
  );

  const showHome = run.status === 'idle' && (homeBlocks?.length ?? 0) > 0;
  const blocksToShow = run.status === 'idle' ? homeBlocks ?? [] : run.blocks;
  const headlineToShow = run.status === 'idle' ? homeHeadline : run.headline;

  return (
    <ErrorBoundary>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
        <PromptBar
          onSubmit={submit}
          busy={run.status === 'streaming'}
          suggestions={run.status === 'idle' ? SUGGESTIONS : undefined}
        />

        {(run.intent || run.decision) && (
          <div className="flex flex-wrap items-center gap-3">
            {run.intent && <IntentChip intent={run.intent} />}
            {run.decision && <ModeChip mode={run.decision.mode} />}
          </div>
        )}

        {headlineToShow && (
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            {headlineToShow}
          </div>
        )}

        {run.status === 'streaming' && run.blocks.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {run.intent ? 'Working through the request…' : 'Understanding your request…'}
          </div>
        )}

        {run.status === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {run.error ?? 'Something went wrong.'}
          </div>
        )}

        {showHome && (
          <p className="text-sm text-muted-foreground">
            Type a request above. The assistant will route it through interpret →
            decide → execute → compose, and stream the result block-by-block.
          </p>
        )}

        <ErrorBoundary>
          <div className="flex flex-col gap-4">
            {blocksToShow.map((block) => (
              <BlockRenderer key={block.id} block={block} onAction={onAction} />
            ))}
          </div>
        </ErrorBoundary>

        {(run.intent || run.decision || run.agentCalls.length > 0) && (
          <AuditTrail
            intent={run.intent}
            decision={run.decision}
            agentCalls={run.agentCalls}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
