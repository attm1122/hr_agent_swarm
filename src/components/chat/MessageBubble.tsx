'use client';

import { Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolCallCard } from './ToolCallCard';
import { MessageFeedback } from '@/components/shared/MessageFeedback';
import type { ClientMessage } from './types';

interface MessageBubbleProps {
  message: ClientMessage;
  onFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
}

export function MessageBubble({ message, onFeedback }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white',
          isUser ? 'bg-[var(--text-primary)]' : 'bg-[var(--primary)]',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-2',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {message.text && (
          <div
            className={cn(
              'whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm leading-relaxed',
              isUser
                ? 'bg-[var(--text-primary)] text-white'
                : 'bg-white text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border-default)]',
            )}
          >
            {message.text}
          </div>
        )}

        {!isUser && message.toolCalls.length > 0 && (
          <div className="flex w-full flex-col gap-1.5">
            {message.toolCalls.map((call, idx) => (
              <ToolCallCard key={`${call.auditId || call.toolName}-${idx}`} call={call} />
            ))}
          </div>
        )}

        {message.pending && !message.text && (
          <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm text-[var(--text-tertiary)] shadow-sm ring-1 ring-[var(--border-default)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}

        {/* Feedback buttons on assistant messages */}
        {!isUser && !message.pending && (
          <MessageFeedback
            messageId={message.id}
            onFeedback={onFeedback}
          />
        )}
      </div>
    </div>
  );
}
