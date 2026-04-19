'use client';

import { useState } from 'react';
import { HelpCircle, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CorrectionPromptProps {
  originalIntent: string;
  alternatives: string[];
  onSelect: (correction: string) => void;
  onDismiss: () => void;
  className?: string;
}

export function CorrectionPrompt({
  originalIntent,
  alternatives,
  onSelect,
  onDismiss,
  className,
}: CorrectionPromptProps) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4',
        className
      )}
      role="dialog"
      aria-label="Clarification needed"
    >
      <div className="flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-[var(--warning)] mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--warning-text)]">
            Did you mean...
          </p>
          <p className="ds-meta mt-0.5">
            Your request: &ldquo;{originalIntent}&rdquo;
          </p>

          <div className="mt-3 space-y-2">
            {alternatives.map((alt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(alt)}
                className="block w-full text-left text-sm px-3 py-2 rounded-md bg-white border border-[var(--border-default)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
              >
                {alt}
              </button>
            ))}

            {!showCustom ? (
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline"
              >
                None of these — I meant something else
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && custom.trim()) {
                      onSelect(custom.trim());
                    }
                  }}
                  placeholder="Clarify what you meant..."
                  className="flex-1 text-sm px-3 py-2 rounded-md border border-[var(--border-default)] bg-white outline-none focus:border-[var(--primary)]"
                  autoFocus
                />
                <Button
                  size="icon"
                  className="h-8 w-8 shrink-0 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
                  onClick={() => custom.trim() && onSelect(custom.trim())}
                  disabled={!custom.trim()}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          aria-label="Dismiss clarification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
