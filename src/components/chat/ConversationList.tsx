'use client';

import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ClientConversation } from './types';

interface ConversationListProps {
  conversations: ClientConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  loading,
}: ConversationListProps) {
  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3">
        <Button
          variant="default"
          size="sm"
          className="w-full justify-start"
          onClick={onNew}
        >
          <Plus className="h-3.5 w-3.5" />
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {loading && (
            <div className="p-3 text-xs text-slate-400">Loading...</div>
          )}

          {!loading && conversations.length === 0 && (
            <div className="p-3 text-xs text-slate-400">
              No conversations yet. Start one to get going.
            </div>
          )}

          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                c.id === activeId
                  ? 'bg-emerald-50 text-emerald-900'
                  : 'text-slate-700 hover:bg-slate-50',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <MessageSquare
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    c.id === activeId ? 'text-emerald-600' : 'text-slate-400',
                  )}
                />
                <span className="truncate">{c.title}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">
        Powered by Claude Sonnet 4.5. Responses are grounded in your HR data.
      </div>
    </div>
  );
}
