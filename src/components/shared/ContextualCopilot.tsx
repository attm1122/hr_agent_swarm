'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ContextualCopilotProps {
  context: string;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
}

export function ContextualCopilot({
  context,
  placeholder,
  suggestions,
  className,
}: ContextualCopilotProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const defaultPlaceholder = placeholder || `Ask about ${context}...`;

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
    setBusy(true);
    // Navigate to workspace with intent
    router.push(`/?intent=${encodeURIComponent(text)}`);
  };

  return (
    <div className={cn('rounded-lg border border-[var(--border-default)] bg-white', className)}>
      <div className="flex items-center gap-2 px-3 py-2">
        <Sparkles className="w-4 h-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex-1 text-left text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {defaultPlaceholder}
          </button>
        ) : (
          <>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') setExpanded(false);
              }}
              placeholder={defaultPlaceholder}
              className="flex-1 text-sm bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              autoFocus
            />
            <Button
              size="icon"
              className="h-7 w-7 shrink-0 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
              onClick={handleSubmit}
              disabled={busy || !input.trim()}
              aria-label="Send"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </>
        )}
      </div>

      {expanded && suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setInput(s);
              }}
              className="text-xs px-2.5 py-1 rounded-full border border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
