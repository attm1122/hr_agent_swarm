/**
 * Composer rules for milestones + anniversaries.
 */

import { randomUUID } from 'node:crypto';
import type { Intent } from '../../intent/types';
import type { DecisionTrace } from '../../decision/types';
import type { ExecutionResult } from '../../execution/types';
import type { UIBlock } from '../types';

export function composeMilestonesWorkspace(
  intent: Intent,
  _decision: DecisionTrace,
  result: ExecutionResult,
): UIBlock[] {
  const data = result.data as {
    kind?: string;
    rows?: Array<Record<string, string | number | null>>;
    rowCount?: number;
    artifactId?: string;
  };

  const rows = data.rows ?? [];
  const artifact = result.artifacts[0];

  const summaryTitle =
    intent.filters?.timeframe === 'next_month'
      ? `${rows.length} anniversaries coming up next month`
      : `${rows.length} milestones in range`;

  const blocks: UIBlock[] = [
    {
      id: randomUUID(),
      kind: 'SummaryCard',
      title: summaryTitle,
      body:
        rows.length > 0
          ? 'Preview below. Download the full sheet for email or sharing.'
          : 'No milestones match the timeframe. Widen the window from the prompt.',
      tone: rows.length > 0 ? 'positive' : 'neutral',
      icon: 'PartyPopper',
      metrics: [
        { label: 'Total', value: rows.length },
        { label: 'Timeframe', value: String(intent.filters?.timeframe ?? 'range') },
      ],
    },
  ];

  if (rows.length > 0) {
    const preview = rows.slice(0, 10);
    blocks.push({
      id: randomUUID(),
      kind: 'Table',
      title: 'Preview (top 10)',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'type', label: 'Type' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'years', label: 'Years', align: 'right', format: 'number' },
        { key: 'team', label: 'Team' },
        { key: 'manager', label: 'Manager' },
      ],
      rows: preview,
      rowCount: rows.length,
    });
  }

  if (artifact) {
    blocks.push({
      id: randomUUID(),
      kind: 'ArtifactPreview',
      title: 'Download spreadsheet',
      filename: artifact.filename,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
      rowCount: rows.length,
      href: artifact.href,
      expiresAt: artifact.expiresAt,
      actions: [
        {
          id: 'download',
          label: 'Download .xlsx',
          variant: 'primary',
          href: artifact.href,
        },
      ],
    });
  }

  blocks.push({
    id: randomUUID(),
    kind: 'ActionBar',
    actions: [
      {
        id: 'email-team',
        label: 'Email to my team',
        variant: 'secondary',
        intent: { rawInput: `Email this sheet to my team: anniversaries next month` },
      },
      {
        id: 'widen',
        label: 'Widen to 90 days',
        variant: 'ghost',
        intent: { rawInput: 'Anniversaries in the next 90 days — send a sheet' },
      },
    ],
  });

  return blocks;
}
