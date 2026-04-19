'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageFeedbackProps {
  messageId: string;
  onFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
  className?: string;
}

export function MessageFeedback({ messageId, onFeedback, className }: MessageFeedbackProps) {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);

  const handleFeedback = (type: 'positive' | 'negative') => {
    if (feedback) return; // Already submitted
    setFeedback(type);
    onFeedback?.(messageId, type);
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span className="ds-meta mr-1">
        {feedback ? 'Thanks for your feedback' : 'Was this helpful?'}
      </span>
      <button
        type="button"
        onClick={() => handleFeedback('positive')}
        disabled={!!feedback}
        className={cn(
          'p-1 rounded transition-colors',
          feedback === 'positive'
            ? 'text-[var(--success)] bg-[var(--success-bg)]'
            : 'text-[var(--text-disabled)] hover:text-[var(--success)] hover:bg-[var(--success-bg)]'
        )}
        aria-label="This was helpful"
        aria-pressed={feedback === 'positive'}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleFeedback('negative')}
        disabled={!!feedback}
        className={cn(
          'p-1 rounded transition-colors',
          feedback === 'negative'
            ? 'text-[var(--danger)] bg-[var(--danger-bg)]'
            : 'text-[var(--text-disabled)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)]'
        )}
        aria-label="This was not helpful"
        aria-pressed={feedback === 'negative'}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
