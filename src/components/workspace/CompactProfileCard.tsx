'use client';

import { User, ChevronDown } from 'lucide-react';
import type { WorkspaceIdentity } from './types';

interface CompactProfileCardProps {
  identity: WorkspaceIdentity;
  onSwitchScope?: () => void;
}

export function CompactProfileCard({ identity, onSwitchScope }: CompactProfileCardProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-white text-sm font-semibold">
        {identity.avatarFallback}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {identity.name}
        </p>
        <button
          onClick={onSwitchScope}
          className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <span className="capitalize">{identity.roleLabel}</span>
          {identity.scope && (
            <>
              <span className="text-[var(--border-default)]">·</span>
              <span>{identity.scope}</span>
            </>
          )}
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
