/**
 * Document Detail Page
 *
 * Comprehensive view of a knowledge document including:
 * - Metadata and governance
 * - Lifecycle status
 * - Version chain
 * - Chunk summaries
 * - Audit trail
 * - Retrieval eligibility
 */

import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { hasCapability } from '@/lib/auth/authorization';
import { redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Archive,
  RefreshCw,
  Layers,
  History,
  Shield,
  User,
  Calendar,
  Globe,
  Tag
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatDateOnly, getDateOnlyRelativeState } from '@/lib/date-only';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Mock document data
async function getDocument(id: string, tenantId: string) {
  // In production: fetch from Supabase
  return {
    id,
    tenantId,
    title: 'Annual Leave Policy 2024',
    content: 'Full policy content here...',
    documentType: 'policy',
    knowledgeZone: 'authoritative_policy',
    jurisdiction: 'AU',
    effectiveDate: '2024-01-01',
    reviewDate: '2024-12-31',
    version: '2.1',
    isCurrentVersion: true,
    
    // Lifecycle
    lifecycleState: 'approved',
    approvalStatus: 'approved',
    
    // Ownership
    ownership: {
      documentOwner: 'hr-team@company.com',
      businessOwner: 'sarah.chen@company.com',
      contentSteward: 'james.wilson@company.com',
      createdBy: 'admin',
      updatedBy: 'admin',
      approvedBy: 'sarah.chen@company.com',
    },
    
    // Governance
    governanceMetadata: {
      sourceAuthorityRank: 'authoritative',
      requiresLegalReview: false,
      requiresHROpsReview: true,
      requiresComplianceReview: false,
      lastReviewedAt: '2024-01-15',
      lastReviewedBy: 'sarah.chen@company.com',
      nextReviewDue: '2024-12-31',
      reviewNotes: 'Annual policy update - approved with minor clarifications',
    },
    
    // Indexing
    indexingMetadata: {
      ingestionStatus: 'completed',
      indexingStatus: 'completed',
      chunksCreated: 12,
      chunksIndexed: 12,
      lastIndexedAt: '2024-01-15T10:30:00Z',
      embeddingModelUsed: 'text-embedding-3-small',
    },
    
    // Audit
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    indexedAt: '2024-01-15T10:30:00Z',
    
    // Chunks preview
    chunks: [
      {
        id: 'chunk-001',
        titlePath: ['Section 1', 'Eligibility'],
        content: 'All full-time employees are entitled to 20 days annual leave...',
        tokenCount: 145,
        isIndexed: true,
      },
      {
        id: 'chunk-002',
        titlePath: ['Section 2', 'Accrual Rates'],
        content: 'Leave accrues at the rate of 1.67 days per month...',
        tokenCount: 132,
        isIndexed: true,
      },
      {
        id: 'chunk-003',
        titlePath: ['Section 3', 'Carry Forward'],
        content: 'Up to 5 days may be carried forward to the next year...',
        tokenCount: 98,
        isIndexed: true,
      },
    ],
    
    // Lifecycle history
    lifecycleHistory: [
      {
        id: 'evt-001',
        timestamp: '2024-01-15T09:00:00Z',
        eventType: 'uploaded',
        actorId: 'admin',
        fromState: undefined,
        toState: 'draft',
      },
      {
        id: 'evt-002',
        timestamp: '2024-01-15T09:30:00Z',
        eventType: 'submitted_for_review',
        actorId: 'admin',
        fromState: 'draft',
        toState: 'pending_review',
      },
      {
        id: 'evt-003',
        timestamp: '2024-01-15T10:30:00Z',
        eventType: 'approved',
        actorId: 'sarah.chen',
        fromState: 'pending_review',
        toState: 'approved',
        reason: 'Annual policy update - approved',
      },
      {
        id: 'evt-004',
        timestamp: '2024-01-15T10:30:00Z',
        eventType: 'indexed',
        actorId: 'system',
        fromState: 'approved',
        toState: 'approved',
      },
    ],
  };
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const session = await getSession();
  
  if (!session || !hasCapability(session.role, 'knowledge:read')) {
    redirect('/unauthorized');
  }

  const { id } = await params;
  const doc = await getDocument(id, session.userId);

  if (!doc) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Link href="/admin/knowledge" className="hover:text-emerald-700">
            Knowledge
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-medium">{doc.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasCapability(session.role, 'knowledge:edit') && (
            <Button variant="outline" size="sm">
              Edit Metadata
            </Button>
          )}
          {hasCapability(session.role, 'knowledge:approve') && doc.lifecycleState === 'pending_review' && (
            <>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={doc.lifecycleState} />
            <Badge variant="outline" className="text-xs">
              {doc.documentType}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {doc.knowledgeZone.replace(/_/g, ' ')}
            </Badge>
            <span className="text-sm text-slate-500">
              Version {doc.version} {doc.isCurrentVersion && '(Current)'}
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chunks">Chunks ({doc.chunks.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Metadata Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-500" />
                  Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetadataRow icon={Globe} label="Jurisdiction" value={doc.jurisdiction} />
                <MetadataRow icon={Calendar} label="Effective Date" value={formatDateOnly(doc.effectiveDate)} />
                <MetadataRow icon={Calendar} label="Review Due" value={formatDateOnly(doc.reviewDate)} />
                <MetadataRow icon={Tag} label="Topics" value="Leave, Benefits, Policy" />
                <MetadataRow icon={User} label="Document Owner" value={doc.ownership.documentOwner} />
                <MetadataRow icon={User} label="Business Owner" value={doc.ownership.businessOwner} />
              </CardContent>
            </Card>

            {/* Governance Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-slate-500" />
                  Governance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetadataRow 
                  icon={Shield} 
                  label="Authority Rank" 
                  value={doc.governanceMetadata.sourceAuthorityRank} 
                />
                <MetadataRow 
                  icon={CheckCircle} 
                  label="Legal Review" 
                  value={doc.governanceMetadata.requiresLegalReview ? 'Required' : 'Not Required'} 
                />
                <MetadataRow 
                  icon={CheckCircle} 
                  label="HR Ops Review" 
                  value={doc.governanceMetadata.requiresHROpsReview ? 'Required' : 'Not Required'} 
                />
                <MetadataRow 
                  icon={CheckCircle} 
                  label="Compliance Review" 
                  value={doc.governanceMetadata.requiresComplianceReview ? 'Required' : 'Not Required'} 
                />
                <MetadataRow 
                  icon={Calendar} 
                  label="Last Reviewed" 
                  value={`${doc.governanceMetadata.lastReviewedAt} by ${doc.governanceMetadata.lastReviewedBy}`} 
                />
                {doc.governanceMetadata.reviewNotes && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-sm font-medium text-slate-700">Review Notes:</p>
                    <p className="text-sm text-slate-600 mt-1">{doc.governanceMetadata.reviewNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Indexing Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5 text-slate-500" />
                  Indexing Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Status</span>
                  <IndexingBadge status={doc.indexingMetadata.indexingStatus} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Chunks Created</span>
                  <span className="text-sm font-medium">{doc.indexingMetadata.chunksCreated}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Chunks Indexed</span>
                  <span className="text-sm font-medium">{doc.indexingMetadata.chunksIndexed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Embedding Model</span>
                  <span className="text-sm font-medium">{doc.indexingMetadata.embeddingModelUsed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Last Indexed</span>
                  <span className="text-sm font-medium">
                    {new Date(doc.indexingMetadata.lastIndexedAt).toLocaleString()}
                  </span>
                </div>
                {hasCapability(session.role, 'knowledge:manage') && (
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reindex Document
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Audit Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-500" />
                  Audit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetadataRow 
                  icon={Calendar} 
                  label="Created" 
                  value={`${new Date(doc.createdAt).toLocaleString()} by ${doc.ownership.createdBy}`} 
                />
                <MetadataRow 
                  icon={Calendar} 
                  label="Last Updated" 
                  value={new Date(doc.updatedAt).toLocaleString()} 
                />
                <MetadataRow 
                  icon={CheckCircle} 
                  label="Approved By" 
                  value={doc.ownership.approvedBy || 'Not yet approved'} 
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="chunks">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Chunks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {doc.chunks.map((chunk, index) => (
                  <div 
                    key={chunk.id} 
                    className="border border-slate-200 rounded-lg p-4 hover:border-emerald-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-500">#{index + 1}</span>
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          {chunk.titlePath.map((title, i) => (
                            <span key={i}>
                              {i > 0 && <span className="mx-1 text-slate-400">&gt;</span>}
                              {title}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {chunk.tokenCount} tokens
                        </Badge>
                        {chunk.isIndexed ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                            Indexed
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mt-3 line-clamp-2">
                      {chunk.content}
                    </p>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <Link 
                        href={`/admin/knowledge/chunks/${chunk.id}`}
                        className="text-sm text-emerald-600 hover:text-emerald-700"
                      >
                        View Chunk Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lifecycle History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {doc.lifecycleHistory.map((event) => (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div className="w-0.5 h-full bg-slate-200 mt-1" />
                    </div>
                    <div className="pb-6">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {event.eventType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-slate-500">
                          by {event.actorId}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                      {event.fromState && (
                        <p className="text-sm text-slate-500 mt-1">
                          {event.fromState} &rarr; {event.toState}
                        </p>
                      )}
                      {event.reason && (
                        <p className="text-sm text-slate-600 mt-1 bg-slate-50 p-2 rounded">
                          {event.reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eligibility">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Retrieval Eligibility</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <EligibilityRow 
                  label="Approved" 
                  value={doc.approvalStatus === 'approved'} 
                  detail="Document must be approved"
                />
                <EligibilityRow 
                  label="Current Version" 
                  value={doc.isCurrentVersion} 
                  detail="Not superseded by newer version"
                />
                <EligibilityRow 
                  label="Not Revoked" 
                  value={doc.lifecycleState !== 'revoked'} 
                  detail="Document has not been revoked"
                />
                <EligibilityRow 
                  label="Not Archived" 
                  value={doc.lifecycleState !== 'archived'} 
                  detail="Document is not archived"
                />
                <EligibilityRow 
                  label="Indexed" 
                  value={doc.indexingMetadata.indexingStatus === 'completed'} 
                  detail="All chunks successfully indexed"
                />
                <EligibilityRow 
                  label="Effective Date Passed" 
                  value={getDateOnlyRelativeState(doc.effectiveDate) !== 'future'} 
                  detail={`Effective: ${formatDateOnly(doc.effectiveDate)}`}
                />
                <EligibilityRow 
                  label="Review Date Valid" 
                  value={getDateOnlyRelativeState(doc.reviewDate) !== 'past'} 
                  detail={`Review Due: ${formatDateOnly(doc.reviewDate)}`}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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

function MetadataRow({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: React.ComponentType<{ className?: string }>;
  label: string; 
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-sm text-slate-600">{value}</p>
      </div>
    </div>
  );
}

function EligibilityRow({ 
  label, 
  value, 
  detail 
}: { 
  label: string; 
  value: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <div>
        <p className="font-medium text-slate-900">{label}</p>
        <p className="text-sm text-slate-500">{detail}</p>
      </div>
      {value ? (
        <CheckCircle className="w-5 h-5 text-emerald-600" />
      ) : (
        <XCircle className="w-5 h-5 text-red-600" />
      )}
    </div>
  );
}
