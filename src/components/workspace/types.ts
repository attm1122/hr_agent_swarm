/**
 * Workspace zone types for the AI-native command center.
 *
 * These types describe the data contracts between the server-side
 * composer and the client-side command surface. They are intentionally
 * flat and serialisable — no functions, no React nodes.
 */

export interface MetricItem {
  id: string;
  label: string;
  value: string | number;
  delta?: { direction: 'up' | 'down' | 'flat'; value: string };
  context?: string;
  href?: string;
}

export interface InsightItem {
  id: string;
  title: string;
  severity: 'neutral' | 'info' | 'warning' | 'danger';
  narrative: string;
  ctaLabel?: string;
  ctaIntent?: string;
  meta?: Record<string, unknown>;
}

export interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  type: 'leave' | 'milestone' | 'review' | 'deadline' | 'event';
  status: 'upcoming' | 'today' | 'overdue' | 'completed';
  assignee?: string;
  assigneeAvatar?: string;
  actionLabel?: string;
  actionIntent?: string;
}

export interface WorkflowItem {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  status: string;
  dueDate?: string;
  assignee?: string;
  actions: Array<{
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    intent?: string;
    href?: string;
  }>;
}

export interface WorkspaceIdentity {
  name: string;
  role: string;
  roleLabel: string;
  avatarFallback: string;
  scope?: string;
}

export interface CommandWorkspaceData {
  identity: WorkspaceIdentity;
  metrics: MetricItem[];
  insights: InsightItem[];
  timeline: TimelineEvent[];
  workflows: WorkflowItem[];
  aiSuggestions: string[];
}
