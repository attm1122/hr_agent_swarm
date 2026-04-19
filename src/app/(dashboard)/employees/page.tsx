export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Plus, Filter } from 'lucide-react';
import { getTeamById, getPositionById, getManagerForEmployee, teams } from '@/lib/data/mock-data';
import { getEmployeeList, getEmployeeCount } from '@/lib/services';
import { getSession, getAgentContext } from '@/lib/auth/session';
import { hasCapability } from '@/lib/auth/authorization';
import { ExportButton } from '@/components/export/ExportButton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { TopActionZone } from '@/components/shared/TopActionZone';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';
import { formatDateOnly, getFullYearsSinceDateOnly } from '@/lib/domain/shared/date-value';
import type { Employee } from '@/types';

function EmployeeDirectorySkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-10 bg-[var(--muted-surface)] animate-pulse rounded-lg" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-14 bg-[var(--muted-surface)] animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

async function EmployeeDirectoryContent() {
  const session = await getSession();
  if (!session) {
    return (
      <EmptyState
        icon={Search}
        title="Authentication Required"
        description="Sign in with a verified session before viewing the employee directory."
      />
    );
  }

  const context = getAgentContext(session);
  const result = await getEmployeeList(context, { status: 'active', limit: 1000 });
  const totalEmployees = await getEmployeeCount(context, { status: 'all' });
  const activeEmployees = result.employees as Employee[];

  const canExport = hasCapability(session.role, 'report:generate');
  const canAddEmployee = hasCapability(session.role, 'employee:write');

  // Build action zone items based on signals
  const actionItems = [];
  const probationDue = activeEmployees.filter(e => {
    const years = getFullYearsSinceDateOnly(e.hireDate);
    return years >= 0 && years < 1 && e.status === 'active';
  });
  if (probationDue.length > 0) {
    actionItems.push({
      id: 'probation-reviews',
      label: `${probationDue.length} probation review${probationDue.length !== 1 ? 's' : ''} due`,
      severity: 'warning' as const,
      description: 'Review and confirm probation status for recent hires',
      action: { label: 'Review' },
    });
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">People</h1>
          <p className="ds-meta mt-1">
            {totalEmployees} total · {activeEmployees.length} active
            {session.role !== 'admin' && ` · view limited by ${session.role} role`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <ExportButton
              context={context}
              exportType="employees"
              variant="outline"
              size="sm"
              className="h-9"
            />
          )}
          {canAddEmployee && (
            <Button size="sm" className="h-9 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Contextual Copilot */}
      <ContextualCopilot
        context="your people directory"
        placeholder="Find people, check headcount trends, or ask about team coverage..."
        suggestions={[
          'Who is on leave next week?',
          'Show me engineers hired this year',
          'Summarize team headcount by department',
        ]}
      />

      {/* Top Action Zone */}
      <TopActionZone items={actionItems.length > 0 ? actionItems : undefined} />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-disabled)]" />
          <Input
            placeholder="Search by name, email, or role..."
            className="pl-9 h-9 text-sm bg-white border-[var(--border-default)]"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teams.map(team => (
              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-[var(--text-tertiary)]">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Employee List — flat, compact, no cards */}
      {activeEmployees.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No employees found"
          description="There are no active employees matching your current filters."
          action={{ label: 'Add Employee', href: '#' }}
        />
      ) : (
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)]">
            <div className="col-span-4">
              <span className="ds-caption">Employee</span>
            </div>
            <div className="col-span-3">
              <span className="ds-caption">Role & Team</span>
            </div>
            <div className="col-span-2">
              <span className="ds-caption">Status</span>
            </div>
            <div className="col-span-2">
              <span className="ds-caption">Hire Date</span>
            </div>
            <div className="col-span-1">
              <span className="ds-caption">Manager</span>
            </div>
          </div>

          {/* Employee Rows */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {activeEmployees.map((employee) => {
              const team = employee.teamId ? getTeamById(employee.teamId) : null;
              const position = employee.positionId ? getPositionById(employee.positionId) : null;
              const manager = getManagerForEmployee(employee);

              return (
                <Link
                  key={employee.id}
                  href={`/employees/${employee.id}`}
                  className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-[var(--muted-surface)] transition-colors"
                >
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarFallback className="bg-[var(--success-bg)] text-[var(--success-text)] text-[11px] font-semibold">
                        {employee.firstName[0]}{employee.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="ds-title truncate">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="ds-meta truncate">{employee.email}</p>
                    </div>
                  </div>

                  <div className="col-span-3 min-w-0">
                    <p className="text-sm text-[var(--text-secondary)] truncate">
                      {position?.title || 'No position'}
                    </p>
                    <p className="ds-meta truncate">{team?.name || 'No team'}</p>
                  </div>

                  <div className="col-span-2">
                    <StatusBadge status={employee.status} size="sm" />
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm text-[var(--text-secondary)]">
                      {formatDateOnly(employee.hireDate)}
                    </p>
                    <p className="ds-meta">
                      {getFullYearsSinceDateOnly(employee.hireDate)} years
                    </p>
                  </div>

                  <div className="col-span-1">
                    <p className="text-sm text-[var(--text-secondary)] truncate">
                      {manager ? `${manager.firstName} ${manager.lastName}` : '—'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeDirectoryPage() {
  return (
    <Suspense fallback={<EmployeeDirectorySkeleton />}>
      <EmployeeDirectoryContent />
    </Suspense>
  );
}
