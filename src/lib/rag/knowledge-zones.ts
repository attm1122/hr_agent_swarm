/**
 * Knowledge Zones Configuration
 * 
 * Defines logical knowledge zones with distinct retrieval rules,
 * permissions, and ranking behaviors.
 * 
 * Zones ensure:
 * - Content is not mixed inappropriately
 * - Different governance applies to different content types
 * - Legal playbooks don't get mixed with system help
 * - Private case data remains strongly isolated
 */

import type { KnowledgeZone, ConfidentialityLevel } from './types';
import type { Role } from '@/types';

// ============================================
// Zone Definitions
// ============================================

export interface ZoneConfig {
  zone: KnowledgeZone;
  name: string;
  description: string;
  priority: number;  // Higher = more authoritative
  defaultRoles: Role[];  // Roles with default access
  maxConfidentiality: ConfidentialityLevel;
  requiresApproval: boolean;
  retrievalRules: {
    preferCurrentVersion: boolean;
    requireJurisdictionMatch: boolean;
    boostAuthority: boolean;
    allowStale: boolean;
  };
  rankingRules: {
    authorityWeight: number;
    recencyWeight: number;
    jurisdictionWeight: number;
    roleMatchWeight: number;
  };
}

export const KNOWLEDGE_ZONE_CONFIG: Record<KnowledgeZone, ZoneConfig> = {
  authoritative_policy: {
    zone: 'authoritative_policy',
    name: 'Authoritative Company Policy',
    description: 'Official, approved company policies and procedures',
    priority: 100,
    defaultRoles: ['admin', 'manager', 'team_lead', 'employee', 'payroll'],
    maxConfidentiality: 'internal',
    requiresApproval: true,
    retrievalRules: {
      preferCurrentVersion: true,
      requireJurisdictionMatch: true,
      boostAuthority: true,
      allowStale: false,
    },
    rankingRules: {
      authorityWeight: 1.0,
      recencyWeight: 0.8,
      jurisdictionWeight: 0.9,
      roleMatchWeight: 0.5,
    },
  },

  legal_playbook: {
    zone: 'legal_playbook',
    name: 'Legal & ER Playbooks',
    description: 'Employment relations guidance, legal precedents, and ER playbooks',
    priority: 90,
    defaultRoles: ['admin'],  // HR only by default
    maxConfidentiality: 'confidential',
    requiresApproval: true,
    retrievalRules: {
      preferCurrentVersion: true,
      requireJurisdictionMatch: true,
      boostAuthority: true,
      allowStale: false,
    },
    rankingRules: {
      authorityWeight: 1.0,
      recencyWeight: 0.9,
      jurisdictionWeight: 1.0,
      roleMatchWeight: 0.7,
    },
  },

  templates_precedents: {
    zone: 'templates_precedents',
    name: 'Templates & Precedents',
    description: 'Approved document templates and drafting precedents',
    priority: 80,
    defaultRoles: ['admin', 'manager'],
    maxConfidentiality: 'internal',
    requiresApproval: true,
    retrievalRules: {
      preferCurrentVersion: true,
      requireJurisdictionMatch: false,
      boostAuthority: true,
      allowStale: false,
    },
    rankingRules: {
      authorityWeight: 0.9,
      recencyWeight: 0.7,
      jurisdictionWeight: 0.5,
      roleMatchWeight: 0.6,
    },
  },

  workflow_sop: {
    zone: 'workflow_sop',
    name: 'Workflow & SOP Guidance',
    description: 'Standard operating procedures and workflow guidance',
    priority: 70,
    defaultRoles: ['admin', 'manager', 'team_lead'],
    maxConfidentiality: 'internal',
    requiresApproval: true,
    retrievalRules: {
      preferCurrentVersion: true,
      requireJurisdictionMatch: false,
      boostAuthority: true,
      allowStale: false,
    },
    rankingRules: {
      authorityWeight: 0.8,
      recencyWeight: 0.8,
      jurisdictionWeight: 0.4,
      roleMatchWeight: 0.7,
    },
  },

  system_help: {
    zone: 'system_help',
    name: 'System & Operational Help',
    description: 'How-to guides for systems and operational processes',
    priority: 60,
    defaultRoles: ['admin', 'manager', 'team_lead', 'employee', 'payroll'],
    maxConfidentiality: 'internal',
    requiresApproval: false,
    retrievalRules: {
      preferCurrentVersion: true,
      requireJurisdictionMatch: false,
      boostAuthority: false,
      allowStale: true,
    },
    rankingRules: {
      authorityWeight: 0.5,
      recencyWeight: 0.9,
      jurisdictionWeight: 0.2,
      roleMatchWeight: 0.4,
    },
  },

  private_case_data: {
    zone: 'private_case_data',
    name: 'Private Case Data',
    description: 'Matter-specific records with strict access controls',
    priority: 50,  // Lower priority to avoid bleeding into general queries
    defaultRoles: ['admin'],  // Explicit access only
    maxConfidentiality: 'legal_privileged',
    requiresApproval: true,
    retrievalRules: {
      preferCurrentVersion: true,
      requireJurisdictionMatch: false,
      boostAuthority: false,
      allowStale: false,
    },
    rankingRules: {
      authorityWeight: 0.6,
      recencyWeight: 1.0,
      jurisdictionWeight: 0.3,
      roleMatchWeight: 0.8,
    },
  },
};

// ============================================
// Zone Access Control
// ============================================

/**
 * Check if role has access to a knowledge zone
 */
export function canAccessZone(
  zone: KnowledgeZone,
  role: Role,
  explicitGrants?: KnowledgeZone[]
): boolean {
  // Check explicit grants first
  if (explicitGrants?.includes(zone)) {
    return true;
  }

  // Check default roles
  const config = KNOWLEDGE_ZONE_CONFIG[zone];
  return config.defaultRoles.includes(role);
}

/**
 * Get accessible zones for a role
 */
export function getAccessibleZones(
  role: Role,
  explicitGrants?: KnowledgeZone[]
): KnowledgeZone[] {
  const zones: KnowledgeZone[] = [];

  for (const [zoneKey, config] of Object.entries(KNOWLEDGE_ZONE_CONFIG)) {
    const zone = zoneKey as KnowledgeZone;

    // Add if default access or explicitly granted
    if (config.defaultRoles.includes(role) || explicitGrants?.includes(zone)) {
      zones.push(zone);
    }
  }

  return zones;
}

/**
 * Filter zones by query risk level
 * Higher risk queries may need to exclude certain zones
 */
export function filterZonesByRisk(
  zones: KnowledgeZone[],
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
): KnowledgeZone[] {
  // For critical risk, only allow authoritative and legal zones
  if (riskLevel === 'critical') {
    return zones.filter(z =>
      z === 'authoritative_policy' ||
      z === 'legal_playbook' ||
      z === 'templates_precedents'
    );
  }

  // For high risk, exclude system help (not authoritative enough)
  if (riskLevel === 'high') {
    return zones.filter(z => z !== 'system_help');
  }

  return zones;
}

/**
 * Get zone priority for ranking
 */
export function getZonePriority(zone: KnowledgeZone): number {
  return KNOWLEDGE_ZONE_CONFIG[zone].priority;
}

/**
 * Sort zones by priority (highest first)
 */
export function sortZonesByPriority(zones: KnowledgeZone[]): KnowledgeZone[] {
  return [...zones].sort((a, b) =>
    getZonePriority(b) - getZonePriority(a)
  );
}

// ============================================
// Zone-Specific Retrieval Rules
// ============================================

/**
 * Get retrieval rules for a zone
 */
export function getRetrievalRules(zone: KnowledgeZone) {
  return KNOWLEDGE_ZONE_CONFIG[zone].retrievalRules;
}

/**
 * Get ranking weights for a zone
 */
export function getRankingWeights(zone: KnowledgeZone) {
  return KNOWLEDGE_ZONE_CONFIG[zone].rankingRules;
}

/**
 * Check if zone requires approved content only
 */
export function requiresApprovedContent(zone: KnowledgeZone): boolean {
  return KNOWLEDGE_ZONE_CONFIG[zone].requiresApproval;
}

/**
 * Get maximum confidentiality level for zone
 */
export function getMaxConfidentiality(zone: KnowledgeZone): ConfidentialityLevel {
  return KNOWLEDGE_ZONE_CONFIG[zone].maxConfidentiality;
}

// ============================================
// Zone Selection Helpers
// ============================================

/**
 * Recommend zones based on query characteristics
 */
export function recommendZones(
  intent: string,
  domain: string,
  risk: 'low' | 'medium' | 'high' | 'critical',
  role: Role
): KnowledgeZone[] {
  const accessible = getAccessibleZones(role);

  // Intent-based recommendations
  const intentZones: Record<string, KnowledgeZone[]> = {
    policy_lookup: ['authoritative_policy'],
    drafting_support: ['templates_precedents', 'authoritative_policy'],
    procedural_help: ['workflow_sop', 'system_help', 'authoritative_policy'],
    manager_guidance: ['workflow_sop', 'authoritative_policy', 'templates_precedents'],
    hr_guidance: ['legal_playbook', 'authoritative_policy', 'templates_precedents'],
    template_lookup: ['templates_precedents'],
    high_risk_er: ['legal_playbook', 'authoritative_policy'],
  };

  // Domain-based recommendations
  const domainZones: Record<string, KnowledgeZone[]> = {
    leave: ['authoritative_policy', 'workflow_sop'],
    probation: ['authoritative_policy', 'legal_playbook'],
    redundancy: ['legal_playbook', 'authoritative_policy', 'templates_precedents'],
    termination: ['legal_playbook', 'authoritative_policy'],
    misconduct: ['legal_playbook', 'authoritative_policy'],
    grievance: ['legal_playbook', 'authoritative_policy'],
    performance: ['authoritative_policy', 'workflow_sop'],
    onboarding: ['workflow_sop', 'system_help', 'authoritative_policy'],
    offboarding: ['workflow_sop', 'legal_playbook', 'authoritative_policy'],
    visa: ['authoritative_policy', 'legal_playbook'],
    payroll: ['authoritative_policy', 'workflow_sop'],
    policies: ['authoritative_policy'],
    systems: ['system_help', 'workflow_sop'],
  };

  // Combine recommendations
  const recommended = new Set<KnowledgeZone>();

  // Add intent-based zones
  const intentRecs = intentZones[intent] || [];
  for (const zone of intentRecs) {
    if (accessible.includes(zone)) {
      recommended.add(zone);
    }
  }

  // Add domain-based zones
  const domainRecs = domainZones[domain] || [];
  for (const zone of domainRecs) {
    if (accessible.includes(zone)) {
      recommended.add(zone);
    }
  }

  // Always include authoritative policy if accessible
  if (accessible.includes('authoritative_policy')) {
    recommended.add('authoritative_policy');
  }

  // Filter by risk
  return filterZonesByRisk(Array.from(recommended), risk);
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate that a document's zone assignment is appropriate
 */
export function validateZoneAssignment(
  zone: KnowledgeZone,
  confidentiality: ConfidentialityLevel,
  approvalStatus: string
): { valid: boolean; error?: string } {
  const config = KNOWLEDGE_ZONE_CONFIG[zone];

  // Check confidentiality level
  const confidentialityLevels: ConfidentialityLevel[] = [
    'public', 'internal', 'manager_only', 'hr_only', 'confidential', 'legal_privileged'
  ];

  const docConfIndex = confidentialityLevels.indexOf(confidentiality);
  const maxConfIndex = confidentialityLevels.indexOf(config.maxConfidentiality);

  if (docConfIndex > maxConfIndex) {
    return {
      valid: false,
      error: `Document confidentiality '${confidentiality}' exceeds zone maximum '${config.maxConfidentiality}'`,
    };
  }

  // Check approval status
  if (config.requiresApproval && approvalStatus !== 'approved') {
    return {
      valid: false,
      error: `Zone '${zone}' requires approved documents only`,
    };
  }

  return { valid: true };
}
