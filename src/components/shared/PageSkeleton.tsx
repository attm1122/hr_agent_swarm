'use client';

import { cn } from '@/lib/utils';

interface PageSkeletonProps {
  rows?: number;
  className?: string;
}

export function PageSkeleton({ rows = 6, className }: PageSkeletonProps) {
  return (
    <div className={cn('space-y-5 animate-pulse', className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-[var(--muted-surface)] rounded-lg" />
          <div className="h-4 w-32 bg-[var(--muted-surface)] rounded" />
        </div>
        <div className="h-9 w-28 bg-[var(--muted-surface)] rounded-lg" />
      </div>

      {/* Copilot skeleton */}
      <div className="h-10 bg-[var(--muted-surface)] rounded-lg" />

      {/* Action zone skeleton */}
      <div className="h-12 bg-[var(--muted-surface)] rounded-lg" />

      {/* List skeleton */}
      <div className="space-y-2">
        <div className="h-10 bg-[var(--muted-surface)] rounded-lg" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 bg-[var(--muted-surface)] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
