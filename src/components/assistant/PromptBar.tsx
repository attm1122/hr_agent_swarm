'use client';

import { useRef, useState, useEffect, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';

export interface PromptBarProps {
  onSubmit: (text: string) => void;
  busy?: boolean;
  suggestions?: string[];
  initialValue?: string;
}

export default function PromptBar({
  onSubmit,
  busy,
  suggestions,
  initialValue,
}: PromptBarProps) {
  const [value, setValue] = useState(initialValue ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialValue !== undefined) setValue(initialValue);
  }, [initialValue]);

  function autoResize() {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 200)}px`;
  }

  useEffect(autoResize, [value]);

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  function send() {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-white/70 p-3 shadow-sm backdrop-blur dark:bg-gray-900/70">
      <div className="flex items-end gap-2">
        <Sparkles className="mt-2 h-5 w-5 shrink-0 text-emerald-500" />
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything — update my address, anniversaries next month, can I terminate this employee…"
          rows={1}
          disabled={busy}
          className="flex-1 resize-none border-0 bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
        />
        <Button
          type="button"
          onClick={send}
          disabled={busy || value.trim().length === 0}
          className="h-9 shrink-0 gap-1.5 bg-emerald-600 px-4 text-white hover:bg-emerald-700"
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
            </>
          ) : (
            <>Run · ⌘↵</>
          )}
        </Button>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onSubmit(s)}
              className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 dark:hover:text-emerald-400"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
