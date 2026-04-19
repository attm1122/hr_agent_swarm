import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookOpen, Search, FileText, Shield, Calendar, DollarSign, UserPlus, Clock } from 'lucide-react';
import { formatDateOnly } from '@/lib/domain/shared/date-value';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';

const policies = [
  { id: 'p-1', title: 'Annual Leave Policy', category: 'leave', version: '3.1', updated: '2025-01-15', sections: 8 },
  { id: 'p-2', title: 'Remote Work Guidelines', category: 'workplace', version: '2.0', updated: '2024-11-01', sections: 12 },
  { id: 'p-3', title: 'Code of Conduct', category: 'compliance', version: '4.0', updated: '2024-09-01', sections: 15 },
  { id: 'p-4', title: 'Expense Reimbursement', category: 'finance', version: '2.2', updated: '2024-10-15', sections: 6 },
  { id: 'p-5', title: 'Onboarding Procedures', category: 'onboarding', version: '1.5', updated: '2025-02-01', sections: 10 },
  { id: 'p-6', title: 'Performance Review Framework', category: 'performance', version: '2.0', updated: '2024-12-01', sections: 9 },
  { id: 'p-7', title: 'Data Protection & Privacy', category: 'compliance', version: '3.0', updated: '2025-03-01', sections: 14 },
  { id: 'p-8', title: 'Compensation & Benefits Guide', category: 'compensation', version: '5.0', updated: '2025-01-01', sections: 18 },
];

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  leave: Calendar,
  workplace: BookOpen,
  compliance: Shield,
  finance: DollarSign,
  onboarding: UserPlus,
  performance: FileText,
  compensation: DollarSign,
};

export default function KnowledgePage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">Knowledge</h1>
          <p className="ds-meta mt-1">{policies.length} policies and guides</p>
        </div>
      </div>

      <ContextualCopilot
        context="policies and procedures"
        placeholder="Ask about leave, compliance, or any company policy..."
        suggestions={[
          'What is our parental leave policy?',
          'How do I request remote work?',
          'Explain the performance review process',
        ]}
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-disabled)]" />
        <Input placeholder="Search policies, procedures, and guides..." className="pl-10 h-10 bg-white border-[var(--border-default)]" />
      </div>

      {/* Stats — flat */}
      <div className="flex items-center gap-8 py-2">
        <div>
          <p className="ds-display">{policies.length}</p>
          <p className="ds-meta">Policies</p>
        </div>
        <div>
          <p className="ds-display">{policies.reduce((s, p) => s + p.sections, 0)}</p>
          <p className="ds-meta">Sections</p>
        </div>
        <div>
          <p className="ds-display">Mar 2025</p>
          <p className="ds-meta">Last Updated</p>
        </div>
      </div>

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {policies.map(p => {
          const Icon = categoryIcons[p.category] || BookOpen;
          return (
            <div key={p.id} className="bg-white rounded-lg border border-[var(--border-default)] p-4 hover:bg-[var(--muted-surface)] transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-[var(--muted-surface)] shrink-0">
                  <Icon className="w-4 h-4 text-[var(--text-tertiary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="ds-title">{p.title}</p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">v{p.version}</Badge>
                  </div>
                  <p className="ds-meta mt-1 capitalize">{p.category} · {p.sections} sections</p>
                  <p className="ds-meta">Updated {formatDateOnly(p.updated)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
