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
import { WelcomeHeader } from './WelcomeHeader';
import { MetricCard } from './MetricCard';
import { EventItem } from './EventItem';
import { ActionCard } from './ActionCard';
import type { CommandWorkspaceData } from './types';
import type { AiOsEvent, Intent, DecisionTrace, UIAction, UIBlock } from '@/lib/ai-os';
import type { ToolCallTrace } from '@/lib/ai/orchestrator';

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
}

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
  const [correction, setCorrection] = useState<{ original: string; alternatives: string[] } | null>(
    null
  );
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
          friendlyMessages[res.status] ?? (await res.text().catch(() => 'Request failed'));
        setRun(r => ({ ...r, status: 'error', error: errText }));
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

      setRun(r => ({ ...r, status: 'done' }));
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setRun(r => ({
        ...r,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  function applyEvent(event: AiOsEvent) {
    setRun(r => {
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
    [submit]
  );

  const isIdle = run.status === 'idle';
  const isStreaming = run.status === 'streaming';
  const blocksToShow = isIdle ? (homeBlocks ?? []) : run.blocks;
  const headlineToShow = isIdle ? homeHeadline : run.headline;

  const progressSteps = [
    {
      id: 'understand',
      label: 'Understanding',
      status: (run.intent ? 'complete' : isStreaming ? 'active' : 'pending') as
        | 'pending'
        | 'active'
        | 'complete'
        | 'error',
    },
    {
      id: 'decide',
      label: 'Deciding',
      status: (run.decision ? 'complete' : run.intent && isStreaming ? 'active' : 'pending') as
        | 'pending'
        | 'active'
        | 'complete'
        | 'error',
    },
    {
      id: 'execute',
      label: 'Executing',
      status: (run.agentCalls.length > 0 && run.status === 'done'
        ? 'complete'
        : run.decision && isStreaming
          ? 'active'
          : 'pending') as 'pending' | 'active' | 'complete' | 'error',
    },
    {
      id: 'compose',
      label: 'Composing',
      status: (run.status === 'done'
        ? 'complete'
        : run.blocks.length > 0 && isStreaming
          ? 'active'
          : 'pending') as 'pending' | 'active' | 'complete' | 'error',
    },
  ];

  return (
    <ErrorBoundary>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
        {/* ─── A. Welcome Header ─── */}
        <WelcomeHeader
          name={data.identity.name}
          roleLabel={data.identity.roleLabel}
          scope={data.identity.scope}
        />

        {/* ─── B. Metrics Row ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.metrics.map(m => (
            <MetricCard
              key={m.id}
              title={m.label}
              value={m.value}
              valueContext={m.valueContext}
              subtext={m.subtext ?? m.context ?? ''}
              change={m.delta?.value}
              changeDirection={m.delta?.direction}
              icon={
                m.id === 'headcount'
                  ? 'users'
                  : m.id === 'approvals'
                    ? 'clipboard'
                    : m.id === 'leave'
                      ? 'plane'
                      : 'shield'
              }
              isUrgent={m.id === 'approvals' || m.id === 'risk'}
            />
          ))}
        </div>

        {/* ─── C/D/E. Main Content: Events + Actions ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left: Upcoming Events */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
              >
                Upcoming Events
              </h2>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {data.timeline.filter(e => e.type === 'event').length} events
              </span>
            </div>

            <div className="rounded-xl border border-[var(--border-default)] bg-white p-4">
              {data.timeline.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-6">
                  No upcoming events
                </p>
              ) : (
                <div className="space-y-0">
                  {data.timeline
                  .filter(e => e.type === 'event')
                  .slice(0, 3)
                  .map((event, i, arr) => (
                    <EventItem
                      key={event.id}
                      time={event.date.includes('T') ? formatTime(event.date) : undefined}
                      title={event.title}
                      description={event.assignee}
                      dotColor="teal"
                      isLast={i === arr.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Action Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
              >
                Action Cards
              </h2>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {data.workflows.filter(w => w.id.startsWith('wf-leave')).slice(0, 3).length} pending
              </span>
            </div>

            <div className="space-y-2">
              {data.workflows.filter(w => w.id.startsWith('wf-leave')).slice(0, 3).length === 0 ? (
                <div className="rounded-xl border border-[var(--success-border)] bg-[var(--success-bg)] p-4 text-center">
                  <p className="text-sm text-[var(--success-text)]">
                    All caught up — no pending actions
                  </p>
                </div>
              ) : (
                data.workflows
                  .filter(w => w.id.startsWith('wf-leave'))
                  .slice(0, 3)
                  .map(item => (
                    <ActionCard
                      key={item.id}
                      title={item.title}
                      isUrgent={true}
                      actions={item.actions.map(a => ({
                        label: a.label,
                        variant:
                          a.variant === 'primary'
                            ? 'primary'
                            : a.variant === 'danger'
                              ? 'secondary'
                              : 'secondary',
                        onClick: a.intent ? () => submit(a.intent!) : undefined,
                      }))}
                    />
                  ))
              )}
            </div>
          </div>
        </div>

        {/* ─── AI Streaming Blocks (appear below metrics when active) ─── */}
        {!isIdle && (
          <div className="space-y-4">
            {isStreaming && <ProgressIndicator steps={progressSteps} />}

            {run.decision && !isStreaming && (
              <div className="flex items-center gap-3">
                <ConfidenceBadge
                  confidence={run.intent?.confidence ?? 0.8}
                  sources={run.decision.reasons.slice(0, 3)}
                />
              </div>
            )}

            {run.status === 'error' && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]"
              >
                {run.error ?? 'Something went wrong.'}
              </div>
            )}

            {isStreaming && run.blocks.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--muted-surface)] px-4 py-6 text-sm text-[var(--text-tertiary)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {run.intent ? 'Checking policies and data...' : 'Understanding your request...'}
              </div>
            )}

            {headlineToShow && (
              <div className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                <Sparkles className="h-4 w-4 text-[var(--primary)]" />
                {headlineToShow}
              </div>
            )}

            <div
              className="flex flex-col gap-3"
              aria-live="polite"
              aria-atomic="false"
              aria-relevant="additions"
            >
              {blocksToShow.map(block => (
                <BlockRenderer key={block.id} block={block} onAction={onAction} />
              ))}
              <div ref={blocksEndRef} />
            </div>

            {(run.intent || run.decision || run.agentCalls.length > 0) && (
              <AuditTrail intent={run.intent} decision={run.decision} agentCalls={run.agentCalls} />
            )}
          </div>
        )}

        {/* ─── Correction prompt ─── */}
        {correction && (
          <CorrectionPrompt
            originalIntent={correction.original}
            alternatives={correction.alternatives}
            onSelect={text => {
              setCorrection(null);
              submit(text);
            }}
            onDismiss={() => setCorrection(null)}
          />
        )}

        {/* ─── F. AI Prompt Bar ─── */}
        <div className="pt-2 space-y-2">
          <div className="rounded-xl border border-[var(--border-default)] bg-white shadow-sm">
            <PromptBar
              onSubmit={submit}
              busy={isStreaming}
              suggestions={isIdle ? data.aiSuggestions : undefined}
            />
          </div>
          {isIdle && data.aiSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 px-2">
              <span className="text-[11px] text-[var(--text-tertiary)]">Suggested:</span>
              {data.aiSuggestions.slice(0, 3).map((s, i) => (
                <button
                  key={i}
                  onClick={() => submit(s)}
                  className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
