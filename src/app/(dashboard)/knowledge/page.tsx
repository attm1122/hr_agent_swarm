import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookOpen, Search, FileText, Shield, Calendar, DollarSign, UserPlus, Clock } from 'lucide-react';
import { formatDateOnly } from '@/lib/domain/shared/date-value';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Knowledge Base</h1>
          <p className="text-sm text-slate-500 mt-0.5">{policies.length} policies and guides</p>
        </div>
      </div>

      {/* Search */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search policies, procedures, and guides..." className="pl-10 h-10" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><BookOpen className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{policies.length}</p><p className="text-xs text-slate-500">Policies</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100"><FileText className="w-4 h-4 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{policies.reduce((s, p) => s + p.sections, 0)}</p><p className="text-xs text-slate-500">Sections</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Clock className="w-4 h-4 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">Mar 2025</p><p className="text-xs text-slate-500">Last Updated</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {policies.map(p => {
          const Icon = categoryIcons[p.category] || BookOpen;
          return (
            <Card key={p.id} className="border shadow-sm hover:bg-slate-50 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 flex-shrink-0"><Icon className="w-4 h-4 text-slate-600" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{p.title}</p>
                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">v{p.version}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 capitalize">{p.category} · {p.sections} sections</p>
                    <p className="text-xs text-slate-400 mt-0.5">Updated {formatDateOnly(p.updated)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
