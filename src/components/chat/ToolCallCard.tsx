'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientToolCall } from './types';

interface ToolCallCardProps {
  call: ClientToolCall;
}

/**
 * A collapsible audit card rendered under an assistant message showing
 * exactly which tool Claude called, its input, and the summarized result.
 * Lets the user trust but verify.
 */
export function ToolCallCard({ call }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        'rounded-md border text-xs transition-colors',
        call.success
          ? 'border-slate-200 bg-slate-50'
          : 'border-red-200 bg-red-50',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        )}
        {call.success ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
        )}
        <Wrench className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <code className="font-mono text-[11px] text-slate-700">
          {call.toolName}
        </code>
        <span className="truncate text-slate-500">{call.summary}</span>
        <span className="ml-auto shrink-0 text-[10px] text-slate-400">
          {call.executionTimeMs}ms
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200 px-3 py-2 font-mono text-[11px] text-slate-700">
          <div className="mb-2">
            <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              Input
            </div>
            <pre className="whitespace-pre-wrap break-words rounded bg-white p-2 text-slate-800">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          {call.data !== undefined && (
            <div>
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                Result data
              </div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-slate-800">
                {JSON.stringify(call.data, null, 2)}
              </pre>
            </div>
          )}
          {call.error && (
            <div className="mt-2 rounded bg-red-50 p-2 text-red-700">
              {call.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
