/**
 * Composer rules for policy / knowledge reads.
 */

import { randomUUID } from 'node:crypto';
import type { Intent } from '../../intent/types';
import type { ExecutionResult } from '../../execution/types';
import type { UIBlock } from '../types';
import { coerceRows } from './shared';

export function composePolicyAnswer(
  _intent: Intent,
  result: ExecutionResult,
): UIBlock[] {
  const first = result.swarmResponses.find((r) => r.intent === 'policy_answer');
  if (!first) return [];
  const data = (first.result.data ?? {}) as Record<string, unknown>;
  const answer = String(data.answer ?? first.result.summary ?? 'No answer.');
  // KnowledgeAgent puts citations both at the AgentResult top-level AND on
  // `data.citations` (via `...answer` spread). Prefer the data path because
  // that reflects the filtered, audience-scoped list. Fall back to the
  // top-level list for older agents that only populate the metadata slot.
  const dataCites = Array.isArray(data.citations)
    ? (data.citations as Array<{ source: string; reference: string }>)
    : [];
  const topCites = (first.result.citations ?? []) as Array<{
    source: string;
    reference: string;
  }>;
  const citations = dataCites.length > 0 ? dataCites : topCites;

  return [
    {
      id: randomUUID(),
      kind: 'SummaryCard',
      title: 'Policy answer',
      body: answer,
      tone: 'neutral',
      icon: 'BookOpen',
    },
    ...(citations.length > 0
      ? [
          {
            id: randomUUID(),
            kind: 'RecommendationPanel' as const,
            title: 'Citations',
            recommendations: citations.map((c, i) => ({
              id: `cite-${i}`,
              title: c.source,
              detail: c.reference,
              severity: 'info' as const,
            })),
          },
        ]
      : []),
  ];
}

export function composeLeaveRead(
  _intent: Intent,
  result: ExecutionResult,
): UIBlock[] {
  const first = result.swarmResponses[0];
  if (!first) return [];
  const data = (first.result.data ?? {}) as Record<string, unknown>;

  if (data.balance) {
    const balance = data.balance as Record<string, unknown>;
    return [
      {
        id: randomUUID(),
        kind: 'SummaryCard',
        title: 'Leave balance',
        body: first.result.summary,
        tone: 'neutral',
        icon: 'Calendar',
        metrics: [
          balance.annualDays !== undefined
            ? { label: 'Annual', value: Number(balance.annualDays) }
            : null,
          balance.sickDays !== undefined
            ? { label: 'Sick', value: Number(balance.sickDays) }
            : null,
          balance.personalDays !== undefined
            ? { label: 'Personal', value: Number(balance.personalDays) }
            : null,
        ].filter(Boolean) as Array<{ label: string; value: string | number }>,
      },
    ];
  }

  // LeaveMilestonesAgent.leave_request returns the enriched requests array
  // directly as `data` (see `createAgentResult(enriched, ...)`). Accept a
  // wrapped shape as a defensive fallback.
  const requests = coerceRows(first.result.data, 'requests', 'items');
  return [
    {
      id: randomUUID(),
      kind: 'Table',
      title: 'Leave',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'type', label: 'Type' },
        { key: 'start', label: 'Start', format: 'date' },
        { key: 'end', label: 'End', format: 'date' },
        { key: 'status', label: 'Status', format: 'badge' },
      ],
      rows: requests.map((r) => ({
        employee: String(r.employeeName ?? ''),
        type: String(r.leaveType ?? r.type ?? ''),
        start: String(r.startDate ?? ''),
        end: String(r.endDate ?? ''),
        status: String(r.status ?? ''),
      })),
      rowCount: requests.length,
    },
  ];
}
