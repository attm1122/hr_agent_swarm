'use client';

import { X } from 'lucide-react';

interface ExpandableDetailPanelProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function ExpandableDetailPanel({ title, children, onClose }: ExpandableDetailPanelProps) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] shadow-sm animate-in slide-in-from-top-1 fade-in duration-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h4>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
