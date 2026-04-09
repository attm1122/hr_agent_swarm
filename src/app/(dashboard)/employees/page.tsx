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
  Search, Filter, Mail, MapPin, Briefcase, User, 
  MoreHorizontal, Download, Plus
} from 'lucide-react';
import { 
  employees, teams, positions, getTeamById, getPositionById, getManagerForEmployee 
} from '@/lib/data/mock-data';
import type { Employee } from '@/types';

// Status badge component
function StatusBadge({ status }: { status: Employee['status'] }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-100 text-slate-700 border-slate-200',
    on_leave: 'bg-amber-100 text-amber-700 border-amber-200',
    terminated: 'bg-red-100 text-red-700 border-red-200',
    pending: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  
  const labels = {
    active: 'Active',
    inactive: 'Inactive',
    on_leave: 'On Leave',
    terminated: 'Terminated',
    pending: 'Pending',
  };
  
  return (
    <Badge variant="outline" className={`${styles[status]} text-xs capitalize`}>
      {labels[status]}
    </Badge>
  );
}

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
              {new Date(employee.hireDate).toLocaleDateString()}
            </p>
            <p className="text-xs text-slate-400">
              {Math.floor((new Date().getTime() - new Date(employee.hireDate).getTime()) / (365 * 24 * 60 * 60 * 1000))} years
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

// Content component
async function EmployeeDirectoryContent() {
  const activeEmployees = employees.filter(e => e.status !== 'terminated');
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Employee Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeEmployees.length} active employees across {teams.length} teams
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
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
