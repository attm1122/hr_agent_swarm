import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, Plus, Send, Clock, CheckCircle2, FileText } from 'lucide-react';
import { formatDateOnly } from '@/lib/domain/shared/date-value';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';
import { StatusBadge } from '@/components/shared/StatusBadge';

const templates = [
  { id: 'ct-1', name: 'Welcome Email', category: 'onboarding', channel: 'email', uses: 12 },
  { id: 'ct-2', name: 'Probation Reminder', category: 'compliance', channel: 'email', uses: 8 },
  { id: 'ct-3', name: 'Anniversary Congratulations', category: 'engagement', channel: 'slack', uses: 15 },
  { id: 'ct-4', name: 'Document Expiry Alert', category: 'compliance', channel: 'email', uses: 6 },
  { id: 'ct-5', name: 'Leave Approval Notification', category: 'leave', channel: 'email', uses: 24 },
  { id: 'ct-6', name: 'Team Announcement', category: 'general', channel: 'slack', uses: 4 },
];

const recentDrafts = [
  { id: 'd-1', subject: 'Welcome aboard, Jessica!', recipient: 'Jessica Wong', status: 'draft' as const, date: '2025-04-01' },
  { id: 'd-2', subject: 'Visa Expiry Reminder', recipient: 'Jessica Wong', status: 'sent' as const, date: '2025-03-28' },
  { id: 'd-3', subject: 'Happy 6 Year Anniversary!', recipient: 'David Park', status: 'sent' as const, date: '2025-03-15' },
];

export default function CommunicationsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">Communications</h1>
          <p className="ds-meta mt-1">{templates.length} templates, {recentDrafts.length} recent drafts</p>
        </div>
        <Button size="sm" className="h-9 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
          <Plus className="w-4 h-4 mr-2" />
          New Draft
        </Button>
      </div>

      <ContextualCopilot
        context="communications and templates"
        placeholder="Draft a message, find a template, or check sent history..."
        suggestions={[
          'Draft a welcome email for a new hire',
          'Find my probation reminder template',
          'What messages are scheduled this week?',
        ]}
      />

      {/* Stats — flat */}
      <div className="flex items-center gap-8 py-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--info)]" />
          <span className="ds-meta">{templates.length} Templates</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--warning)]" />
          <span className="ds-meta">1 Draft</span>
        </div>
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-[var(--success)]" />
          <span className="ds-meta">2 Sent This Week</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Templates */}
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--info)]" />
            <span className="ds-caption">Templates</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                {t.channel === 'email' ? <Mail className="w-4 h-4 text-[var(--text-disabled)]" /> : <MessageSquare className="w-4 h-4 text-[var(--text-disabled)]" />}
                <div className="flex-1 min-w-0">
                  <p className="ds-title">{t.name}</p>
                  <p className="ds-meta capitalize">{t.category} · {t.channel}</p>
                </div>
                <Badge variant="secondary" className="text-[11px]">{t.uses} uses</Badge>
                <Button variant="ghost" size="sm" className="h-7 text-xs">Use</Button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Drafts */}
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)] flex items-center gap-2">
            <Send className="w-4 h-4 text-[var(--success)]" />
            <span className="ds-caption">Recent Activity</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {recentDrafts.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="ds-title">{d.subject}</p>
                  <p className="ds-meta">To: {d.recipient} · {formatDateOnly(d.date)}</p>
                </div>
                <StatusBadge status={d.status} size="sm" />
                {d.status === 'draft' && (
                  <Button size="sm" className="h-7 text-xs bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">Send</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
