import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Shield, FileText, AlertTriangle, Clock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { documents, milestones, getEmployeeById } from '@/lib/data/mock-data';
import { formatDateOnly } from '@/lib/domain/shared/date-value';
import { compareMilestonesByDate, getDerivedMilestoneState, getMilestoneDayOffset } from '@/lib/milestones';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TopActionZone } from '@/components/shared/TopActionZone';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';

export default function CompliancePage() {
  const expiringDocs = documents.filter(d => d.status === 'expiring');
  const missingDocs = documents.filter(d => d.status === 'missing');
  const expiredDocs = documents.filter(d => d.status === 'expired');
  const activeDocs = documents.filter(d => d.status === 'active');

  const visaExpiries = milestones.filter(
    (m) => m.milestoneType === 'visa_expiry' && getDerivedMilestoneState(m) !== 'completed'
  );
  const certExpiries = milestones.filter(
    (m) => m.milestoneType === 'certification_expiry' && getDerivedMilestoneState(m) !== 'completed'
  );
  const probations = milestones.filter(
    (m) => m.milestoneType === 'probation_end' && getDerivedMilestoneState(m) !== 'completed'
  );
  const allAlerts = [...visaExpiries, ...certExpiries, ...probations].sort(compareMilestonesByDate);

  const criticalCount = expiredDocs.length + missingDocs.length;
  const warningCount = expiringDocs.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">Compliance</h1>
          <p className="ds-meta mt-1">
            {criticalCount + warningCount + allAlerts.length} items requiring attention · {activeDocs.length} compliant
          </p>
        </div>
      </div>

      {/* Copilot */}
      <ContextualCopilot
        context="compliance and documents"
        placeholder="Check document status, review expiring visas, or find policy requirements..."
        suggestions={[
          'Which visas expire in the next 30 days?',
          'Show me all missing documents',
          'What is our document retention policy?',
        ]}
      />

      {/* Action Zone */}
      <TopActionZone
        items={[
          ...(criticalCount > 0 ? [{
            id: 'critical-docs',
            label: `${criticalCount} expired or missing document${criticalCount !== 1 ? 's' : ''}`,
            severity: 'critical' as const,
            description: 'Immediate action required to remain compliant',
            action: { label: 'Review', onClick: () => {} },
          }] : []),
          ...(warningCount > 0 ? [{
            id: 'expiring-docs',
            label: `${warningCount} document${warningCount !== 1 ? 's' : ''} expiring soon`,
            severity: 'warning' as const,
            description: 'Renew before expiration to avoid compliance gaps',
            action: { label: 'Renew', onClick: () => {} },
          }] : []),
        ]}
      />

      {/* Summary stats — flat */}
      <div className="flex items-center gap-6 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--danger)]" />
          <span className="ds-meta">{criticalCount} Critical</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
          <span className="ds-meta">{warningCount} Expiring</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
          <span className="ds-meta">{activeDocs.length} Compliant</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--info)]" />
          <span className="ds-meta">{allAlerts.length} Upcoming</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Documents */}
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)] flex items-center justify-between">
            <span className="ds-caption">Documents</span>
            <span className="ds-meta">{documents.length} tracked</span>
          </div>
          {documents.length === 0 ? (
            <div className="py-8 text-center">
              <p className="ds-body">No documents tracked</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {documents.slice(0, 10).map(doc => {
                const emp = getEmployeeById(doc.employeeId);
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                    <FileText className="w-4 h-4 text-[var(--text-disabled)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="ds-title truncate">{doc.fileName}</p>
                      <p className="ds-meta">
                        {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'} · {doc.category}
                        {doc.expiresAt && ` · Expires ${formatDateOnly(doc.expiresAt)}`}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} size="sm" />
                    {emp && (
                      <Link href={`/employees/${emp.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)] flex items-center justify-between">
            <span className="ds-caption">Upcoming Alerts</span>
            <span className="ds-meta">{allAlerts.length} total</span>
          </div>
          {allAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="w-10 h-10 text-[var(--success)] mb-2" />
              <p className="ds-body">No upcoming compliance alerts</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {allAlerts.map(ms => {
                const emp = getEmployeeById(ms.employeeId);
                const state = getDerivedMilestoneState(ms);
                const dayOffset = getMilestoneDayOffset(ms);
                return (
                  <div key={ms.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="bg-[var(--muted-surface)] text-[var(--text-tertiary)] text-[10px]">
                        {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="ds-title">{ms.description}</p>
                      <p className="ds-meta">
                        {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'} · {formatDateOnly(ms.milestoneDate)}
                      </p>
                    </div>
                    <Badge variant="outline" className={
                      state === 'overdue' || dayOffset === 0
                        ? 'status-danger text-[11px]'
                        : dayOffset < 60
                          ? 'status-warning text-[11px]'
                          : 'status-info text-[11px]'
                    }>
                      {state === 'overdue'
                        ? `Overdue ${Math.abs(dayOffset)}d`
                        : dayOffset === 0
                          ? 'Due today'
                          : `${dayOffset}d left`}
                    </Badge>
                    {emp && (
                      <Link href={`/employees/${emp.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
