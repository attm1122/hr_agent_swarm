/**
 * Knowledge Zones Unit Tests
 * 
 * Comprehensive test coverage for knowledge zone configuration,
 * access control, and zone recommendations.
 */

import { describe, it, expect } from 'vitest';
import {
  KNOWLEDGE_ZONE_CONFIG,
  canAccessZone,
  getAccessibleZones,
  filterZonesByRisk,
  getZonePriority,
  sortZonesByPriority,
  getRetrievalRules,
  getRankingWeights,
  requiresApprovedContent,
  getMaxConfidentiality,
  recommendZones,
  validateZoneAssignment,
} from './knowledge-zones';
import type { Role } from '@/types';
import type { KnowledgeZone, ConfidentialityLevel } from '@/types/rag';

describe('KNOWLEDGE_ZONE_CONFIG', () => {
  it('should define all knowledge zones', () => {
    const zones: KnowledgeZone[] = [
      'authoritative_policy',
      'legal_playbook',
      'templates_precedents',
      'workflow_sop',
      'system_help',
      'private_case_data',
    ];

    for (const zone of zones) {
      expect(KNOWLEDGE_ZONE_CONFIG[zone]).toBeDefined();
      expect(KNOWLEDGE_ZONE_CONFIG[zone].zone).toBe(zone);
    }
  });

  it('should have correct priorities', () => {
    expect(KNOWLEDGE_ZONE_CONFIG.authoritative_policy.priority).toBe(100);
    expect(KNOWLEDGE_ZONE_CONFIG.legal_playbook.priority).toBe(90);
    expect(KNOWLEDGE_ZONE_CONFIG.templates_precedents.priority).toBe(80);
    expect(KNOWLEDGE_ZONE_CONFIG.workflow_sop.priority).toBe(70);
    expect(KNOWLEDGE_ZONE_CONFIG.system_help.priority).toBe(60);
    expect(KNOWLEDGE_ZONE_CONFIG.private_case_data.priority).toBe(50);
  });

  it('authoritative_policy should require approval', () => {
    expect(KNOWLEDGE_ZONE_CONFIG.authoritative_policy.requiresApproval).toBe(true);
  });

  it('system_help should not require approval', () => {
    expect(KNOWLEDGE_ZONE_CONFIG.system_help.requiresApproval).toBe(false);
  });

  it('legal_playbook should be restricted to admin/HR', () => {
    expect(KNOWLEDGE_ZONE_CONFIG.legal_playbook.defaultRoles).toContain('admin');
    expect(KNOWLEDGE_ZONE_CONFIG.legal_playbook.defaultRoles).not.toContain('manager');
    expect(KNOWLEDGE_ZONE_CONFIG.legal_playbook.defaultRoles).not.toContain('employee');
  });

  it('authoritative_policy should be accessible to all roles', () => {
    const allRoles: Role[] = ['admin', 'manager', 'team_lead', 'employee', 'payroll'];
    for (const role of allRoles) {
      expect(KNOWLEDGE_ZONE_CONFIG.authoritative_policy.defaultRoles).toContain(role);
    }
  });
});

describe('canAccessZone', () => {
  it('should allow admin access to all zones', () => {
    const zones: KnowledgeZone[] = [
      'authoritative_policy',
      'legal_playbook',
      'templates_precedents',
      'workflow_sop',
      'system_help',
    ];

    for (const zone of zones) {
      expect(canAccessZone(zone, 'admin')).toBe(true);
    }
  });

  it('should allow employee access to authoritative_policy', () => {
    expect(canAccessZone('authoritative_policy', 'employee')).toBe(true);
  });

  it('should deny employee access to legal_playbook', () => {
    expect(canAccessZone('legal_playbook', 'employee')).toBe(false);
  });

  it('should deny employee access to templates_precedents', () => {
    expect(canAccessZone('templates_precedents', 'employee')).toBe(false);
  });

  it('should allow manager access to workflow_sop', () => {
    expect(canAccessZone('workflow_sop', 'manager')).toBe(true);
  });

  it('should allow manager access to templates_precedents', () => {
    expect(canAccessZone('templates_precedents', 'manager')).toBe(true);
  });

  it('should deny manager access to legal_playbook', () => {
    expect(canAccessZone('legal_playbook', 'manager')).toBe(false);
  });

  it('should allow access via explicit grants', () => {
    expect(canAccessZone('legal_playbook', 'manager', ['legal_playbook'])).toBe(true);
  });

  it('should deny access to private_case_data without explicit grant', () => {
    expect(canAccessZone('private_case_data', 'admin')).toBe(true);  // Admin has default
    expect(canAccessZone('private_case_data', 'manager')).toBe(false);
  });
});

describe('getAccessibleZones', () => {
  it('should return appropriate zones for employee', () => {
    const zones = getAccessibleZones('employee');
    expect(zones).toContain('authoritative_policy');
    expect(zones).toContain('system_help');
    expect(zones).not.toContain('legal_playbook');
    expect(zones).not.toContain('templates_precedents');
  });

  it('should return more zones for manager', () => {
    const zones = getAccessibleZones('manager');
    expect(zones).toContain('authoritative_policy');
    expect(zones).toContain('workflow_sop');
    expect(zones).toContain('templates_precedents');
    expect(zones).toContain('system_help');
  });

  it('should return all zones for admin', () => {
    const zones = getAccessibleZones('admin');
    expect(zones).toContain('authoritative_policy');
    expect(zones).toContain('legal_playbook');
    expect(zones).toContain('private_case_data');
  });

  it('should include explicitly granted zones', () => {
    const zones = getAccessibleZones('employee', ['templates_precedents']);
    expect(zones).toContain('templates_precedents');
  });
});

describe('filterZonesByRisk', () => {
  it('should filter to authoritative only for critical risk', () => {
    const zones: KnowledgeZone[] = [
      'authoritative_policy',
      'legal_playbook',
      'templates_precedents',
      'workflow_sop',
      'system_help',
    ];

    const filtered = filterZonesByRisk(zones, 'critical');
    expect(filtered).toContain('authoritative_policy');
    expect(filtered).toContain('legal_playbook');
    expect(filtered).toContain('templates_precedents');
    expect(filtered).not.toContain('system_help');
  });

  it('should exclude system_help for high risk', () => {
    const zones: KnowledgeZone[] = [
      'authoritative_policy',
      'workflow_sop',
      'system_help',
    ];

    const filtered = filterZonesByRisk(zones, 'high');
    expect(filtered).toContain('authoritative_policy');
    expect(filtered).toContain('workflow_sop');
    expect(filtered).not.toContain('system_help');
  });

  it('should return all zones for low risk', () => {
    const zones: KnowledgeZone[] = [
      'authoritative_policy',
      'system_help',
    ];

    const filtered = filterZonesByRisk(zones, 'low');
    expect(filtered).toEqual(zones);
  });
});

describe('getZonePriority', () => {
  it('should return correct priorities', () => {
    expect(getZonePriority('authoritative_policy')).toBe(100);
    expect(getZonePriority('legal_playbook')).toBe(90);
    expect(getZonePriority('system_help')).toBe(60);
  });
});

describe('sortZonesByPriority', () => {
  it('should sort zones by priority descending', () => {
    const zones: KnowledgeZone[] = [
      'system_help',
      'authoritative_policy',
      'legal_playbook',
    ];

    const sorted = sortZonesByPriority(zones);
    expect(sorted[0]).toBe('authoritative_policy');
    expect(sorted[1]).toBe('legal_playbook');
    expect(sorted[2]).toBe('system_help');
  });
});

describe('getRetrievalRules', () => {
  it('should return preferCurrentVersion for authoritative_policy', () => {
    const rules = getRetrievalRules('authoritative_policy');
    expect(rules.preferCurrentVersion).toBe(true);
    expect(rules.allowStale).toBe(false);
  });

  it('should allow stale content for system_help', () => {
    const rules = getRetrievalRules('system_help');
    expect(rules.allowStale).toBe(true);
  });

  it('should require jurisdiction match for legal_playbook', () => {
    const rules = getRetrievalRules('legal_playbook');
    expect(rules.requireJurisdictionMatch).toBe(true);
  });
});

describe('getRankingWeights', () => {
  it('should return weights for authoritative_policy', () => {
    const weights = getRankingWeights('authoritative_policy');
    expect(weights.authorityWeight).toBe(1.0);
    expect(weights.jurisdictionWeight).toBe(0.9);
  });

  it('should return different weights for system_help', () => {
    const weights = getRankingWeights('system_help');
    expect(weights.authorityWeight).toBe(0.5);
    expect(weights.recencyWeight).toBe(0.9);
  });
});

describe('requiresApprovedContent', () => {
  it('should require approval for authoritative_policy', () => {
    expect(requiresApprovedContent('authoritative_policy')).toBe(true);
  });

  it('should require approval for legal_playbook', () => {
    expect(requiresApprovedContent('legal_playbook')).toBe(true);
  });

  it('should not require approval for system_help', () => {
    expect(requiresApprovedContent('system_help')).toBe(false);
  });
});

describe('getMaxConfidentiality', () => {
  it('should return internal for authoritative_policy', () => {
    expect(getMaxConfidentiality('authoritative_policy')).toBe('internal');
  });

  it('should return confidential for legal_playbook', () => {
    expect(getMaxConfidentiality('legal_playbook')).toBe('confidential');
  });

  it('should return legal_privileged for private_case_data', () => {
    expect(getMaxConfidentiality('private_case_data')).toBe('legal_privileged');
  });
});

describe('recommendZones', () => {
  it('should recommend authoritative_policy for policy_lookup', () => {
    const zones = recommendZones('policy_lookup', 'leave', 'low', 'employee');
    expect(zones).toContain('authoritative_policy');
  });

  it('should recommend templates_precedents for drafting_support', () => {
    const zones = recommendZones('drafting_support', 'general', 'medium', 'manager');
    expect(zones).toContain('templates_precedents');
  });

  it('should recommend workflow_sop for procedural_help', () => {
    const zones = recommendZones('procedural_help', 'leave', 'low', 'manager');
    expect(zones).toContain('workflow_sop');
  });

  it('should recommend legal_playbook for high_risk_er', () => {
    const zones = recommendZones('high_risk_er', 'termination', 'critical', 'admin');
    expect(zones).toContain('legal_playbook');
  });

  it('should filter zones by risk level', () => {
    const zones = recommendZones('hr_guidance', 'redundancy', 'critical', 'admin');
    expect(zones).not.toContain('system_help');
  });

  it('should respect role access restrictions', () => {
    // Admin gets legal_playbook for high_risk_er, manager does not
    const adminZones = recommendZones('high_risk_er', 'misconduct', 'high', 'admin');
    expect(adminZones).toContain('legal_playbook');

    const managerZones = recommendZones('high_risk_er', 'misconduct', 'high', 'manager');
    // Manager should not get legal_playbook (not in default roles)
    expect(managerZones).not.toContain('legal_playbook');
  });

  it('should recommend zones based on domain', () => {
    const zones = recommendZones('policy_lookup', 'redundancy', 'high', 'admin');
    expect(zones).toContain('legal_playbook');
  });
});

describe('validateZoneAssignment', () => {
  it('should validate appropriate assignment', () => {
    const result = validateZoneAssignment(
      'authoritative_policy',
      'internal',
      'approved'
    );
    expect(result.valid).toBe(true);
  });

  it('should reject confidential in internal zone', () => {
    const result = validateZoneAssignment(
      'authoritative_policy',
      'confidential',
      'approved'
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds zone maximum');
  });

  it('should reject draft in approval-required zone', () => {
    const result = validateZoneAssignment(
      'authoritative_policy',
      'internal',
      'draft'
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('requires approved documents');
  });

  it('should allow draft in system_help zone', () => {
    const result = validateZoneAssignment(
      'system_help',
      'internal',
      'draft'
    );
    expect(result.valid).toBe(true);
  });

  it('should allow confidential in legal_playbook zone', () => {
    const result = validateZoneAssignment(
      'legal_playbook',
      'confidential',
      'approved'
    );
    expect(result.valid).toBe(true);
  });

  it('should reject legal_privileged outside private_case_data', () => {
    const result = validateZoneAssignment(
      'legal_playbook',
      'legal_privileged',
      'approved'
    );
    expect(result.valid).toBe(false);
  });
});
