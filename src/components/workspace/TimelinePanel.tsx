'use client';

import { useState } from 'react';
import {
  Calendar,
  Clock,
  Flag,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Plane,
  Award,
  FileText,
} from 'lucide-react';
import type { TimelineEvent } from './types';
import { formatDateOnly } from '@/lib/domain/shared/date-value';
import { ExpandableDetailPanel } from './ExpandableDetailPanel';

interface TimelinePanelProps {
  events: TimelineEvent[];
  onAskAi?: (question: string) => void;
}

const typeConfig = {
  leave: { icon: Plane, label: 'Leave' },
  milestone: { icon: Award, label: 'Milestone' },
  review: { icon: FileText, label: 'Review' },
  deadline: { icon: Clock, label: 'Deadline' },
  event: { icon: Calendar, label: 'Event' },
};

const statusConfig = {
  upcoming: { icon: Clock, color: 'text-[var(--info)]', bg: 'bg-[var(--info-bg)]' },
  today: { icon: Flag, color: 'text-[var(--warning)]', bg: 'bg-[var(--warning-bg)]' },
  overdue: { icon: AlertCircle, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger-bg)]' },
  completed: { icon: CheckCircle2, color: 'text-[var(--success)]', bg: 'bg-[var(--success-bg)]' },
};

export function TimelinePanel({ events, onAskAi }: TimelinePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-6 text-center">
        <Calendar className="w-5 h-5 text-[var(--text-tertiary)] mx-auto mb-2" />
        <p className="text-sm text-[var(--text-tertiary)]">No upcoming events</p>
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Upcoming
        </h3>
        <span className="text-[11px] text-[var(--text-tertiary)]">{sorted.length} events</span>
      </div>

      <div className="relative pl-3">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[var(--border-subtle)]" />

        <div className="space-y-2">
          {sorted.slice(0, 8).map((event) => {
            const tCfg = typeConfig[event.type];
            const sCfg = statusConfig[event.status];
            const TypeIcon = tCfg.icon;
            const StatusIcon = sCfg.icon;

            return (
              <button
                key={event.id}
                onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                className="group relative flex items-start gap-3 w-full text-left py-1.5"
              >
                {/* Timeline dot */}
                <div className={`relative z-10 mt-1.5 h-2 w-2 rounded-full ${sCfg.bg} ring-2 ring-[var(--surface-base)]`}>
                  <div className={`h-full w-full rounded-full ${sCfg.color.replace('text-', 'bg-')}`} />
                </div>

                <div className="flex-1 min-w-0 rounded-md px-2 py-1 -mx-2 transition-colors group-hover:bg-[var(--surface-interactive)]">
                  <div className="flex items-center gap-2">
                    <TypeIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {event.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                      {formatDateOnly(event.date)}
                    </span>
                    {event.assignee && (
                      <>
                        <span className="text-[var(--border-default)]">·</span>
                        <span className="text-[11px] text-[var(--text-secondary)] truncate max-w-[100px]">
                          {event.assignee}
                        </span>
                      </>
                    )}
                    {event.status === 'today' && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--warning)]">
                        <StatusIcon className="w-3 h-3" />
                        Today
                      </span>
                    )}
                    {event.status === 'overdue' && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--danger)]">
                        <StatusIcon className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>
      </div>

      {expandedId && (
        <ExpandableDetailPanel
          title={events.find((e) => e.id === expandedId)?.title ?? ''}
          onClose={() => setExpandedId(null)}
        >
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              {formatDateOnly(events.find((e) => e.id === expandedId)?.date ?? '')}
            </p>
            {onAskAi && (
              <button
                onClick={() => onAskAi(`Tell me about ${events.find((e) => e.id === expandedId)?.title}`)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline"
              >
                Ask AI about this event
              </button>
            )}
          </div>
        </ExpandableDetailPanel>
      )}
    </div>
  );
}
