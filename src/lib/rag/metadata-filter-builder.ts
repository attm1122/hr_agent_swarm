/**
 * Metadata Filter Builder
 * 
 * Constructs metadata filters from query classification for use in retrieval.
 * Filters are applied BEFORE semantic/lexical search to narrow the candidate pool.
 * 
 * Security: All filters include tenant isolation and permission constraints.
 * 
 * Filter Types:
 * - Tenant isolation (required)
 * - Permission/zone access
 * - Jurisdiction matching
 * - Version constraints (prefer current, allow stale)
 * - Content approval status
 * - Date ranges (effective, review dates)
 * - Audience/role matching
 * - Confidentiality levels
 */

import type {
  QueryClassification,
  KnowledgeZone,
  Jurisdiction,
  ApprovalStatus,
  ConfidentialityLevel,
} from './types';
import type { Role } from '@/types';
import { getAccessibleZones, requiresApprovedContent } from './knowledge-zones';
import { getDateOnlyRelativeState } from '@/lib/domain/shared/date-value';

// ============================================
// Filter Types
// ============================================

export interface MetadataFilter {
  // Tenant isolation (always applied)
  tenantId: string;

  // Knowledge zones (OR filter - any zone allowed)
  zones?: KnowledgeZone[];

  // Jurisdiction matching
  jurisdiction?: Jurisdiction | 'any';
  preferJurisdictionMatch?: boolean;

  // Version constraints
  isCurrentVersion?: boolean;
  allowStale?: boolean;

  // Approval status
  approvalStatus?: ApprovalStatus[];

  // Confidentiality ceiling
  maxConfidentiality?: ConfidentialityLevel;

  // Date constraints
  effectiveBefore?: string;  // ISO date
  effectiveAfter?: string;
  notExpired?: boolean;  // reviewDate > now

  // Audience/role matching
  audienceIncludes?: Role[];

  // Document type filter
  documentTypes?: string[];

  // Topic filter
  topics?: string[];

  // Explicit document inclusion/exclusion
  includeDocumentIds?: string[];
  excludeDocumentIds?: string[];

  // Legal entity filter
  legalEntity?: string | null;
}

export interface ChunkFilter {
  // Document filter reference
  documentFilter: MetadataFilter;

  // Chunk-specific filters
  maxTokenCount?: number;
  minTokenCount?: number;

  // Content type filters
  contentTypes?: ('heading' | 'paragraph' | 'list' | 'table' | 'step')[];

  // Section/path filters
  sectionHeading?: string;

  // Keyword presence
  mustContainKeywords?: string[];
  shouldContainKeywords?: string[];
}

// ============================================
// Filter Builder
// ============================================

/**
 * Build metadata filter from query classification
 * 
 * This is the main entry point for creating retrieval filters.
 * It translates query classification into concrete filter constraints.
 */
export function buildMetadataFilter(
  classification: QueryClassification,
  tenantId: string,
  role: Role,
  explicitGrants?: KnowledgeZone[]
): MetadataFilter {
  const filter: MetadataFilter = {
    tenantId,
  };

  // 1. Zone access (intersection of allowed and requested)
  const accessibleZones = getAccessibleZones(role, explicitGrants);
  const requestedZones = classification.allowedZones;
  const effectiveZones = requestedZones.filter(z => accessibleZones.includes(z));

  if (effectiveZones.length > 0) {
    filter.zones = effectiveZones;
  } else {
    // Fallback to zones the role can access
    filter.zones = accessibleZones;
  }

  // 2. Jurisdiction matching
  if (classification.jurisdiction !== 'unknown') {
    filter.jurisdiction = classification.jurisdiction;
    filter.preferJurisdictionMatch = true;
  }

  // 3. Version constraints based on query needs
  filter.isCurrentVersion = true;

  // For system_help or low-risk queries, may allow older versions
  if (classification.allowedZones.includes('system_help') && classification.risk === 'low') {
    filter.allowStale = true;
  }

  // 4. Approval status based on zones
  const anyZoneRequiresApproval = filter.zones?.some(z => requiresApprovedContent(z)) ?? false;
  if (anyZoneRequiresApproval) {
    filter.approvalStatus = ['approved'];
  }

  // 5. Confidentiality ceiling based on role
  filter.maxConfidentiality = getMaxConfidentialityForRole(role);

  // 6. Date constraints - exclude expired documents
  filter.notExpired = true;

  // 7. Audience matching for role-specific content
  if (classification.actor === 'manager') {
    filter.audienceIncludes = ['manager', 'admin', 'team_lead'];
  } else if (classification.actor === 'hr') {
    filter.audienceIncludes = ['admin'];
  }

  return filter;
}

/**
 * Get maximum confidentiality level a role can access
 */
function getMaxConfidentialityForRole(role: Role): ConfidentialityLevel {
  const levels: Record<Role, ConfidentialityLevel> = {
    admin: 'legal_privileged',
    manager: 'manager_only',
    team_lead: 'manager_only',
    employee: 'internal',
    payroll: 'confidential',
  };

  return levels[role] || 'internal';
}

// ============================================
// Filter Operations
// ============================================

/**
 * Check if a document matches the filter
 */
export function documentMatchesFilter(
  doc: {
    tenantId: string;
    knowledgeZone: KnowledgeZone;
    jurisdiction: Jurisdiction;
    isCurrentVersion: boolean;
    approvalStatus: ApprovalStatus;
    confidentiality: ConfidentialityLevel;
    reviewDate: string | null;
    audience: Role[];
    legalEntity: string | null;
  },
  filter: MetadataFilter
): boolean {
  // Tenant isolation (strict)
  if (doc.tenantId !== filter.tenantId) {
    return false;
  }

  // Zone filter
  if (filter.zones && !filter.zones.includes(doc.knowledgeZone)) {
    return false;
  }

  // Jurisdiction filter (exact match required if specified)
  if (filter.jurisdiction && filter.jurisdiction !== 'any') {
    if (doc.jurisdiction !== filter.jurisdiction && doc.jurisdiction !== 'AU') {
      return false;
    }
  }

  // Version filter
  if (filter.isCurrentVersion && !doc.isCurrentVersion) {
    return false;
  }

  // Approval status filter
  if (filter.approvalStatus && !filter.approvalStatus.includes(doc.approvalStatus)) {
    return false;
  }

  // Confidentiality filter
  if (filter.maxConfidentiality) {
    if (!isConfidentialityAtOrBelow(doc.confidentiality, filter.maxConfidentiality)) {
      return false;
    }
  }

  // Expiration filter
  if (filter.notExpired && doc.reviewDate) {
    if (getDateOnlyRelativeState(doc.reviewDate) === 'past') {
      return false;
    }
  }

  // Audience filter
  if (filter.audienceIncludes) {
    const hasMatchingAudience = filter.audienceIncludes.some(role =>
      doc.audience.includes(role)
    );
    if (!hasMatchingAudience) {
      return false;
    }
  }

  // Document inclusion filter
  if (filter.includeDocumentIds && filter.includeDocumentIds.length > 0) {
    // This would need the document ID - handled at repository level
  }

  // Document exclusion filter
  if (filter.excludeDocumentIds && filter.excludeDocumentIds.length > 0) {
    // This would need the document ID - handled at repository layer
  }

  return true;
}

/**
 * Check if confidentiality level is at or below the maximum allowed
 */
function isConfidentialityAtOrBelow(
  level: ConfidentialityLevel,
  max: ConfidentialityLevel
): boolean {
  const hierarchy: ConfidentialityLevel[] = [
    'public',
    'internal',
    'manager_only',
    'hr_only',
    'confidential',
    'legal_privileged',
  ];

  const levelIndex = hierarchy.indexOf(level);
  const maxIndex = hierarchy.indexOf(max);

  return levelIndex <= maxIndex;
}

// ============================================
// Filter Serialization for Supabase
// ============================================

/**
 * Convert metadata filter to Supabase query constraints
 * 
 * Returns an object suitable for .match() or .or() chains
 */
export function toSupabaseFilter(filter: MetadataFilter): Record<string, unknown> {
  const constraints: Record<string, unknown> = {
    tenant_id: filter.tenantId,
  };

  if (filter.zones && filter.zones.length > 0) {
    // Use 'in' operator for zones
    if (filter.zones.length === 1) {
      constraints.knowledge_zone = filter.zones[0];
    }
    // Multiple zones require or() - handled at repository layer
  }

  if (filter.jurisdiction && filter.jurisdiction !== 'any') {
    constraints.jurisdiction = filter.jurisdiction;
  }

  if (filter.isCurrentVersion !== undefined) {
    constraints.is_current_version = filter.isCurrentVersion;
  }

  if (filter.approvalStatus && filter.approvalStatus.length > 0) {
    if (filter.approvalStatus.length === 1) {
      constraints.approval_status = filter.approvalStatus[0];
    }
    // Multiple statuses require or() - handled at repository layer
  }

  if (filter.legalEntity !== undefined) {
    constraints.legal_entity = filter.legalEntity;
  }

  return constraints;
}

/**
 * Build PostgREST query string for complex filters
 */
export function toPostgrestQuery(filter: MetadataFilter): string {
  const conditions: string[] = [];

  // Tenant isolation
  conditions.push(`tenant_id=eq.${filter.tenantId}`);

  // Zones (OR)
  if (filter.zones && filter.zones.length > 0) {
    if (filter.zones.length === 1) {
      conditions.push(`knowledge_zone=eq.${filter.zones[0]}`);
    } else {
      const zoneOr = filter.zones.map(z => `knowledge_zone.eq.${z}`).join(',');
      conditions.push(`or=(${zoneOr})`);
    }
  }

  // Jurisdiction
  if (filter.jurisdiction && filter.jurisdiction !== 'any') {
    conditions.push(`jurisdiction=eq.${filter.jurisdiction}`);
  }

  // Current version
  if (filter.isCurrentVersion) {
    conditions.push('is_current_version=eq.true');
  }

  // Approval status
  if (filter.approvalStatus && filter.approvalStatus.length > 0) {
    if (filter.approvalStatus.length === 1) {
      conditions.push(`approval_status=eq.${filter.approvalStatus[0]}`);
    } else {
      const statusOr = filter.approvalStatus.map(s => `approval_status.eq.${s}`).join(',');
      conditions.push(`or=(${statusOr})`);
    }
  }

  // Not expired
  if (filter.notExpired) {
    const now = new Date().toISOString();
    conditions.push(`or=(review_date.is.null,review_date.gt.${now})`);
  }

  return conditions.join('&');
}

// ============================================
// Filter Combination
// ============================================

/**
 * Merge two metadata filters (intersection)
 */
export function mergeFilters(a: MetadataFilter, b: MetadataFilter): MetadataFilter {
  // Must be same tenant
  if (a.tenantId !== b.tenantId) {
    throw new Error('Cannot merge filters from different tenants');
  }

  const merged: MetadataFilter = {
    tenantId: a.tenantId,
  };

  // Zones: intersection
  if (a.zones && b.zones) {
    merged.zones = a.zones.filter(z => b.zones?.includes(z));
  } else if (a.zones) {
    merged.zones = a.zones;
  } else if (b.zones) {
    merged.zones = b.zones;
  }

  // Jurisdiction: if both specify, use a's preference
  if (a.jurisdiction && a.jurisdiction !== 'any') {
    merged.jurisdiction = a.jurisdiction;
    merged.preferJurisdictionMatch = a.preferJurisdictionMatch || b.preferJurisdictionMatch;
  } else if (b.jurisdiction && b.jurisdiction !== 'any') {
    merged.jurisdiction = b.jurisdiction;
    merged.preferJurisdictionMatch = b.preferJurisdictionMatch;
  }

  // Version: more restrictive wins
  merged.isCurrentVersion = a.isCurrentVersion || b.isCurrentVersion;
  merged.allowStale = (a.allowStale && b.allowStale) || false;

  // Approval: union of both
  if (a.approvalStatus || b.approvalStatus) {
    const aSet = new Set(a.approvalStatus || []);
    const bSet = new Set(b.approvalStatus || []);
    merged.approvalStatus = Array.from(new Set([...aSet, ...bSet]));
  }

  // Confidentiality: more restrictive (lower) wins
  if (a.maxConfidentiality && b.maxConfidentiality) {
    merged.maxConfidentiality = getMoreRestrictiveConfidentiality(
      a.maxConfidentiality,
      b.maxConfidentiality
    );
  } else {
    merged.maxConfidentiality = a.maxConfidentiality || b.maxConfidentiality;
  }

  return merged;
}

/**
 * Get the more restrictive (lower in hierarchy) confidentiality level
 */
function getMoreRestrictiveConfidentiality(
  a: ConfidentialityLevel,
  b: ConfidentialityLevel
): ConfidentialityLevel {
  const hierarchy: ConfidentialityLevel[] = [
    'public',
    'internal',
    'manager_only',
    'hr_only',
    'confidential',
    'legal_privileged',
  ];

  const aIndex = hierarchy.indexOf(a);
  const bIndex = hierarchy.indexOf(b);

  return aIndex <= bIndex ? a : b;
}

// ============================================
// Predefined Filters
// ============================================

/**
 * Create a filter for current approved policy documents
 */
export function createPolicyFilter(
  tenantId: string,
  role: Role,
  jurisdiction?: Jurisdiction
): MetadataFilter {
  return {
    tenantId,
    zones: ['authoritative_policy'],
    jurisdiction: jurisdiction || 'any',
    isCurrentVersion: true,
    approvalStatus: ['approved'],
    notExpired: true,
    maxConfidentiality: getMaxConfidentialityForRole(role),
  };
}

/**
 * Create a filter for legal playbook access
 */
export function createLegalPlaybookFilter(
  tenantId: string,
  jurisdiction?: Jurisdiction
): MetadataFilter {
  return {
    tenantId,
    zones: ['legal_playbook'],
    jurisdiction: jurisdiction || 'any',
    isCurrentVersion: true,
    approvalStatus: ['approved'],
    notExpired: true,
    maxConfidentiality: 'legal_privileged',
  };
}

/**
 * Create a filter for template search
 */
export function createTemplateFilter(
  tenantId: string,
  role: Role
): MetadataFilter {
  return {
    tenantId,
    zones: ['templates_precedents', 'authoritative_policy'],
    isCurrentVersion: true,
    approvalStatus: ['approved'],
    notExpired: true,
    maxConfidentiality: getMaxConfidentialityForRole(role),
  };
}
