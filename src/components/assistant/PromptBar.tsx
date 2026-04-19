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

export default function PromptBar({ onSubmit, busy, suggestions, initialValue }: PromptBarProps) {
  const [value, setValue] = useState(initialValue ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);

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
    <div className="flex flex-col gap-3 rounded-xl border border-[#E5E2DD] bg-white p-3 shadow-sm">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type @ to search prompt prompts, sps or options..."
          rows={1}
          disabled={busy}
          className="flex-1 resize-none border-0 bg-transparent text-sm leading-relaxed text-[#1A1A1A] outline-none placeholder:text-[#9C9C9C] disabled:opacity-50"
        />
        <Button
          type="button"
          onClick={send}
          disabled={busy || value.trim().length === 0}
          className="h-9 w-9 shrink-0 p-0 bg-[#F8F6F3] text-[#9C9C9C] hover:bg-[#F0EDE8] hover:text-[#1A1A1A] border border-[#E5E2DD]"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </Button>
      </div>

      {/* Suggestions rendered below by CommandWorkspace */}
    </div>
  );
}
