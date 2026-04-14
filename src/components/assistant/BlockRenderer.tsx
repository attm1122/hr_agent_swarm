'use client';

/**
 * BlockRenderer — switch on `block.kind` and dispatch to the leaf component.
 * Lazy-loaded with React.lazy so the initial bundle stays small.
 */

import { Suspense, lazy } from 'react';
import type { UIAction, UIBlock } from '@/lib/ai-os';

const blockMap = {
  SummaryCard: lazy(() => import('./blocks/SummaryCard')),
  ConfirmationCard: lazy(() => import('./blocks/ConfirmationCard')),
  RiskBanner: lazy(() => import('./blocks/RiskBanner')),
  RecommendationPanel: lazy(() => import('./blocks/RecommendationPanel')),
  EditableForm: lazy(() => import('./blocks/EditableForm')),
  DocumentEditor: lazy(() => import('./blocks/DocumentEditor')),
  Table: lazy(() => import('./blocks/TableBlock')),
  Chart: lazy(() => import('./blocks/ChartBlock')),
  Timeline: lazy(() => import('./blocks/TimelineBlock')),
  ApprovalPanel: lazy(() => import('./blocks/ApprovalPanel')),
  TaskChecklist: lazy(() => import('./blocks/TaskChecklist')),
  ArtifactPreview: lazy(() => import('./blocks/ArtifactPreview')),
  ActionBar: lazy(() => import('./blocks/ActionBar')),
} as const;

export interface BlockRendererProps {
  block: UIBlock;
  onAction?: (action: UIAction) => void;
}

function Skeleton() {
  return (
    <div className="h-24 w-full animate-pulse rounded-xl bg-muted/40" />
  );
}

export default function BlockRenderer({ block, onAction }: BlockRendererProps) {
  const Component = blockMap[block.kind] as
    | React.LazyExoticComponent<
        React.ComponentType<{
          block: UIBlock;
          onAction?: (a: UIAction) => void;
        }>
      >
    | undefined;

  if (!Component) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
        Unknown block kind: <code>{(block as { kind: string }).kind}</code>
      </div>
    );
  }

  return (
    <Suspense fallback={<Skeleton />}>
      {/* Lazy components are typed loosely above so each leaf can keep its own
          narrow prop. The underlying components do their own type narrowing
          on `block.kind`. */}
      <Component block={block} onAction={onAction} />
    </Suspense>
  );
}
