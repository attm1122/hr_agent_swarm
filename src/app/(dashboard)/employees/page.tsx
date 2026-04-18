export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Search, Filter, Plus, MoreHorizontal, ShieldX
} from 'lucide-react';
import { getTeamById, getPositionById, getManagerForEmployee, teams } from '@/lib/data/mock-data';
import { getEmployeeList, getEmployeeCount } from '@/lib/services';
import { getSession, getAgentContext } from '@/lib/auth/session';
import { hasCapability } from '@/lib/auth/authorization';
import { ExportButton } from '@/components/export/ExportButton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDateOnly, getFullYearsSinceDateOnly } from '@/lib/date-only';
import type { Employee } from '@/types';

// Employee row component
function EmployeeRow({ employee }: { employee: Employee }) {
  const team = employee.teamId ? getTeamById(employee.teamId) : null;
  const position = employee.positionId ? getPositionById(employee.positionId) : null;
  const manager = getManagerForEmployee(employee);
  
  return (
    <Link href={`/employees/${employee.id}`}>
      <div className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer">
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-medium">
            {employee.firstName[0]}{employee.lastName[0]}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-3">
            <p className="text-sm font-medium text-slate-900 truncate">
              {employee.firstName} {employee.lastName}
            </p>
            <p className="text-xs text-slate-500 truncate">{employee.email}</p>
          </div>
          
          <div className="col-span-3">
            <p className="text-sm text-slate-700 truncate">{position?.title || 'No position'}</p>
            <p className="text-xs text-slate-500 truncate">{team?.name || 'No team'}</p>
          </div>
          
          <div className="col-span-2">
            <StatusBadge status={employee.status} />
          </div>
          
          <div className="col-span-2">
            <p className="text-sm text-slate-600">
              {formatDateOnly(employee.hireDate)}
            </p>
            <p className="text-xs text-slate-400">
              {getFullYearsSinceDateOnly(employee.hireDate)} years
            </p>
          </div>
          
          <div className="col-span-2">
            <p className="text-sm text-slate-600 truncate">
              {manager ? `${manager.firstName} ${manager.lastName}` : 'No manager'}
            </p>
          </div>
        </div>
        
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="w-4 h-4 text-slate-400" />
        </Button>
      </div>
    </Link>
  );
}

// Loading skeleton
function EmployeeDirectorySkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-14 bg-slate-100 animate-pulse rounded-lg" />
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// Content component - uses service layer with RBAC enforcement
async function EmployeeDirectoryContent() {
  // Get session and context for RBAC
  const session = await getSession();
  if (!session) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-8 text-center">
          <ShieldX className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h1 className="text-lg font-semibold text-slate-900">Authentication Required</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in with a verified session before viewing the employee directory.
          </p>
        </CardContent>
      </Card>
    );
  }
  const context = getAgentContext(session);

  // Use service layer for RBAC-filtered data
  const result = await getEmployeeList(context, { status: 'active', limit: 1000 });
  const totalEmployees = await getEmployeeCount(context, { status: 'all' });

  // Cast to Employee type for display
  const activeEmployees = result.employees as Employee[];

  // Check capabilities for UI controls
  const canExport = hasCapability(session.role, 'report:generate');
  const canAddEmployee = hasCapability(session.role, 'employee:write');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Employee Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalEmployees} total employees • Showing {activeEmployees.length} active (role-limited)
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            View restricted by your role: {session.role}
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
            <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search by name, email, or role..."
                className="pl-9 h-9"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-40 h-9">
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
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card className="border shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="w-10" /> {/* Avatar spacer */}
          <div className="flex-1 grid grid-cols-12 gap-4">
            <div className="col-span-3">
              <span className="text-xs font-medium text-slate-500 uppercase">Employee</span>
            </div>
            <div className="col-span-3">
              <span className="text-xs font-medium text-slate-500 uppercase">Role & Team</span>
            </div>
            <div className="col-span-2">
              <span className="text-xs font-medium text-slate-500 uppercase">Status</span>
            </div>
            <div className="col-span-2">
              <span className="text-xs font-medium text-slate-500 uppercase">Hire Date</span>
            </div>
            <div className="col-span-2">
              <span className="text-xs font-medium text-slate-500 uppercase">Manager</span>
            </div>
          </div>
          <div className="w-8" /> {/* Actions spacer */}
        </div>
        
        {/* Employee Rows */}
        <div className="divide-y divide-slate-100">
          {activeEmployees.map((employee) => (
            <EmployeeRow key={employee.id} employee={employee} />
          ))}
        </div>
      </Card>
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
