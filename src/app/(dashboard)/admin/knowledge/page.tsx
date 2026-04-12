/**
 * Knowledge Inventory Page
 *
 * Admin view for managing knowledge documents with comprehensive filtering,
 * status indicators, and quick actions.
 */

import { Suspense } from 'react';
import { getSession } from '@/lib/auth/session';
import { hasCapability } from '@/lib/auth/authorization';
import { redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Plus, 
  Filter, 
  Search,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Archive,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  differenceFromTodayInDateOnlyDays,
  formatDateOnly,
  getDateOnlyRelativeState,
} from '@/lib/date-only';

// Mock data for POC - replace with actual API calls
async function getKnowledgeDocuments(tenantId: string, filters?: Record<string, string>) {
  // In production: fetch from Supabase with filters
  return [
    {
      id: 'doc-001',
      title: 'Annual Leave Policy 2024',
      documentType: 'policy',
      knowledgeZone: 'authoritative_policy',
      jurisdiction: 'AU',
      lifecycleState: 'approved',
      approvalStatus: 'approved',
      isCurrentVersion: true,
      effectiveDate: '2024-01-01',
      reviewDate: '2024-12-31',
      owner: 'HR Team',
      createdAt: '2024-01-15',
      chunkCount: 12,
      indexingStatus: 'completed',
    },
    {
      id: 'doc-002',
      title: 'Remote Work Guidelines',
      documentType: 'guideline',
      knowledgeZone: 'workflow_sop',
      jurisdiction: 'AU',
      lifecycleState: 'pending_review',
      approvalStatus: 'pending_approval',
      isCurrentVersion: true,
      effectiveDate: '2024-03-01',
      reviewDate: '2025-03-01',
      owner: 'People Operations',
      createdAt: '2024-02-10',
      chunkCount: 8,
      indexingStatus: 'pending',
    },
    {
      id: 'doc-003',
      title: 'Disciplinary Procedure Template',
      documentType: 'template',
      knowledgeZone: 'templates_precedents',
      jurisdiction: 'AU-NSW',
      lifecycleState: 'approved',
      approvalStatus: 'approved',
      isCurrentVersion: false,
      effectiveDate: '2023-06-01',
      reviewDate: '2024-06-01',
      owner: 'Legal Team',
      createdAt: '2023-06-01',
      chunkCount: 6,
      indexingStatus: 'completed',
      supersededBy: 'doc-004',
    },
  ];
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function KnowledgeInventoryPage({ searchParams }: PageProps) {
  const session = await getSession();
  
  if (!session || !hasCapability(session.role, 'knowledge:read')) {
    redirect('/unauthorized');
  }

  const params = await searchParams;
  const filters = Object.fromEntries(
    Object.entries(params).filter(([, v]) => typeof v === 'string')
  ) as Record<string, string>;

  const documents = await getKnowledgeDocuments(session.userId, filters);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Knowledge Inventory
          </h2>
          <p className="text-slate-600 mt-1">
            Manage documents, policies, templates, and SOPs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          {hasCapability(session.role, 'knowledge:upload') && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Documents"
          value={documents.length.toString()}
          icon={Database}
          variant="default"
        />
        <StatCard
          title="Approved"
          value={documents.filter(d => d.approvalStatus === 'approved').length.toString()}
          icon={CheckCircle}
          variant="emerald"
        />
        <StatCard
          title="Pending Review"
          value={documents.filter(d => d.lifecycleState === 'pending_review').length.toString()}
          icon={Clock}
          variant="amber"
        />
        <StatCard
          title="Needs Review"
          value={documents.filter((document) => getDateOnlyRelativeState(document.reviewDate) === 'past').length.toString()}
          icon={AlertCircle}
          variant="red"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <FilterSelect label="Type" options={['All', 'Policy', 'Template', 'SOP', 'Guideline']} />
            <FilterSelect label="Zone" options={['All', 'Authoritative Policy', 'Templates', 'SOPs', 'Legal Playbook']} />
            <FilterSelect label="Status" options={['All', 'Approved', 'Pending', 'Rejected', 'Superseded']} />
            <FilterSelect label="Jurisdiction" options={['All', 'AU', 'AU-NSW', 'AU-VIC', 'AU-QLD']} />
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Document</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Zone</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Version</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Indexing</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Review Due</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div>
                        <Link 
                          href={`/admin/knowledge/documents/${doc.id}`}
                          className="font-medium text-slate-900 hover:text-emerald-700"
                        >
                          {doc.title}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {doc.jurisdiction} • {doc.chunkCount} chunks
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs">
                        {doc.documentType}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {doc.knowledgeZone.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={doc.lifecycleState} />
                    </td>
                    <td className="py-3 px-4">
                      {doc.isCurrentVersion ? (
                        <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                          Current
                        </Badge>
                      ) : doc.supersededBy ? (
                        <Badge variant="secondary" className="text-xs">
                          Superseded
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Draft
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <IndexingBadge status={doc.indexingStatus} />
                    </td>
                    <td className="py-3 px-4">
                      <ReviewDate date={doc.reviewDate} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/knowledge/documents/${doc.id}`}
                          className="text-sm text-emerald-600 hover:text-emerald-700"
                        >
                          View
                        </Link>
                        {hasCapability(session.role, 'knowledge:edit') && (
                          <Link
                            href={`/admin/knowledge/documents/${doc.id}/edit`}
                            className="text-sm text-slate-600 hover:text-slate-900"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  variant 
}: { 
  title: string; 
  value: string; 
  icon: React.ComponentType<{ className?: string }>;
  variant: 'default' | 'emerald' | 'amber' | 'red' | 'navy';
}) {
  const variantStyles = {
    default: 'bg-white border-slate-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
    navy: 'bg-slate-900 border-slate-800 text-white',
  };

  return (
    <Card className={cn('border', variantStyles[variant])}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={cn(
              'text-sm font-medium',
              variant === 'navy' ? 'text-slate-400' : 'text-slate-600'
            )}>
              {title}
            </p>
            <p className={cn(
              'text-2xl font-bold mt-1',
              variant === 'navy' ? 'text-white' : 'text-slate-900'
            )}>
              {value}
            </p>
          </div>
          <Icon className={cn(
            'w-5 h-5',
            variant === 'navy' ? 'text-slate-400' : 'text-slate-400'
          )} />
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({ 
  label, 
  options 
}: { 
  label: string; 
  options: string[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600">{label}:</span>
      <select className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white">
        {options.map(opt => (
          <option key={opt} value={opt.toLowerCase().replace(/\s+/g, '_')}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    pending_review: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    superseded: 'bg-slate-100 text-slate-600',
    revoked: 'bg-red-50 text-red-700',
    archived: 'bg-slate-100 text-slate-500',
  };

  return (
    <Badge className={cn('text-xs', styles[status] || styles.draft)}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

function IndexingBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    processing: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <Badge className={cn('text-xs', styles[status] || styles.pending)}>
      {status}
    </Badge>
  );
}

function ReviewDate({ date }: { date: string }) {
  const dayOffset = differenceFromTodayInDateOnlyDays(date);
  const isOverdue = dayOffset < 0;
  const isSoon = !isOverdue && dayOffset <= 30;

  return (
    <span className={cn(
      'text-sm',
      isOverdue ? 'text-red-600 font-medium' : 
      isSoon ? 'text-amber-600' : 'text-slate-600'
    )}>
      {formatDateOnly(date)}
      {isOverdue && ' (Overdue)'}
    </span>
  );
}
