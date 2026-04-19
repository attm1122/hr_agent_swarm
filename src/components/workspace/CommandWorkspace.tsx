'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import PromptBar from '@/components/assistant/PromptBar';
import { ProgressIndicator } from '@/components/assistant/ProgressIndicator';
import BlockRenderer from '@/components/assistant/BlockRenderer';
import AuditTrail from '@/components/assistant/AuditTrail';
import ErrorBoundary from '@/components/assistant/ErrorBoundary';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { CorrectionPrompt } from '@/components/shared/CorrectionPrompt';
import { CompactProfileCard } from './CompactProfileCard';
import { MetricsRow } from './MetricsRow';
import { InsightPanel } from './InsightPanel';
import { TimelinePanel } from './TimelinePanel';
import { WorkflowList } from './WorkflowList';
import type { CommandWorkspaceData } from './types';
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
  status: 'idle' | 'streaming' | 'done' | 'error' | 'clarifying';
  rawInput?: string;
}

const EMPTY_RUN: RunState = {
  blocks: [],
  agentCalls: [],
  status: 'idle',
};

interface CommandWorkspaceProps {
  data: CommandWorkspaceData;
  homeBlocks?: UIBlock[];
  homeHeadline?: string;
}

export default function CommandWorkspace({
  data,
  homeBlocks,
  homeHeadline,
}: CommandWorkspaceProps) {
  const [run, setRun] = useState<RunState>(EMPTY_RUN);
  const [correction, setCorrection] = useState<{ original: string; alternatives: string[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const blocksEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    blocksEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [run.blocks.length]);

  const submit = useCallback(async (text: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCorrection(null);
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
          503: 'The AI service is temporarily unavailable. Try again in a moment.',
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
          } catch {
            // ignore bad frames
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
          return r;
        case 'clarification_required':
          return { ...r, status: 'clarifying' };
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

  const isIdle = run.status === 'idle';
  const isStreaming = run.status === 'streaming';
  const blocksToShow = isIdle ? homeBlocks ?? [] : run.blocks;
  const headlineToShow = isIdle ? homeHeadline : run.headline;

  const progressSteps = [
    { id: 'understand', label: 'Understanding', status: (run.intent ? 'complete' : isStreaming ? 'active' : 'pending') as 'pending' | 'active' | 'complete' | 'error' },
    { id: 'decide', label: 'Deciding', status: (run.decision ? 'complete' : run.intent && isStreaming ? 'active' : 'pending') as 'pending' | 'active' | 'complete' | 'error' },
    { id: 'execute', label: 'Executing', status: (run.agentCalls.length > 0 && run.status === 'done' ? 'complete' : run.decision && isStreaming ? 'active' : 'pending') as 'pending' | 'active' | 'complete' | 'error' },
    { id: 'compose', label: 'Composing', status: (run.status === 'done' ? 'complete' : run.blocks.length > 0 && isStreaming ? 'active' : 'pending') as 'pending' | 'active' | 'complete' | 'error' },
  ];

  return (
    <ErrorBoundary>
      <div className="mx-auto w-full max-w-7xl px-4 py-5 space-y-5">
        {/* ─── Top row: Identity + Metrics ─── */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <CompactProfileCard identity={data.identity} />
          <MetricsRow metrics={data.metrics} />
        </div>

        {/* ─── Main grid: Insight + Timeline + Workflow ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Insight Panel (occupies 5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Headline */}
            {headlineToShow && (
              <div className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                <Sparkles className="h-4 w-4 text-[var(--primary)]" />
                {headlineToShow}
              </div>
            )}

            {/* Streaming progress */}
            {isStreaming && <ProgressIndicator steps={progressSteps} />}

            {/* Confidence */}
            {run.decision && !isStreaming && (
              <div className="flex items-center gap-3">
                <ConfidenceBadge
                  confidence={run.intent?.confidence ?? 0.8}
                  sources={run.decision.reasons.slice(0, 3)}
                />
                {run.decision.mode === 'ESCALATE' && (
                  <span className="ds-meta text-[var(--warning-text)]">Human review required</span>
                )}
              </div>
            )}

            {/* Error */}
            {run.status === 'error' && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]"
              >
                {run.error ?? 'Something went wrong.'}
              </div>
            )}

            {/* Loading state */}
            {isStreaming && run.blocks.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--muted-surface)] px-4 py-6 text-sm text-[var(--text-tertiary)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {run.intent ? 'Checking policies and data...' : 'Understanding your request...'}
              </div>
            )}

            {/* AI Blocks OR Idle Insights */}
            <div
              className="flex flex-col gap-3"
              aria-live="polite"
              aria-atomic="false"
              aria-relevant="additions"
            >
              {blocksToShow.map((block) => (
                <BlockRenderer key={block.id} block={block} onAction={onAction} />
              ))}
              <div ref={blocksEndRef} />
            </div>

            {/* Idle insights when no AI running */}
            {isIdle && (
              <InsightPanel
                insights={data.insights}
                onAskAi={(q) => submit(q)}
              />
            )}

            {/* Audit trail */}
            {(run.intent || run.decision || run.agentCalls.length > 0) && (
              <AuditTrail
                intent={run.intent}
                decision={run.decision}
                agentCalls={run.agentCalls}
              />
            )}
          </div>

          {/* Center: Timeline (occupies 3 cols) */}
          <div className="lg:col-span-3">
            <TimelinePanel
              events={data.timeline}
              onAskAi={(q) => submit(q)}
            />
          </div>

          {/* Right: Workflow Rail (occupies 4 cols) */}
          <div className="lg:col-span-4">
            <WorkflowList
              items={data.workflows}
              onAction={(intent) => submit(intent)}
            />
          </div>
        </div>

        {/* ─── Correction prompt ─── */}
        {correction && (
          <CorrectionPrompt
            originalIntent={correction.original}
            alternatives={correction.alternatives}
            onSelect={(text) => {
              setCorrection(null);
              submit(text);
            }}
            onDismiss={() => setCorrection(null)}
          />
        )}

        {/* ─── AI Command Bar (Bottom) ─── */}
        <div className="sticky bottom-4 z-20">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] shadow-lg backdrop-blur-sm">
            <PromptBar
              onSubmit={submit}
              busy={isStreaming}
              suggestions={isIdle ? data.aiSuggestions : undefined}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
