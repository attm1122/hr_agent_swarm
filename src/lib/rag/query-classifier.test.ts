/**
 * Query Classifier Unit Tests
 * 
 * Comprehensive test coverage for query classification logic.
 * Tests risk detection, intent classification, domain detection,
 * jurisdiction identification, and response mode determination.
 */

import { describe, it, expect } from 'vitest';
import { classifyQuery, TEST_EXPORTS } from './query-classifier';
import type { AgentContext } from '@/types';
import type { QueryIntent, QueryDomain, RiskLevel, ResponseMode } from '@/types/rag';

const {
  determineActor,
  assessRisk,
  determineIntent,
  determineDomain,
  determineJurisdiction,
  determineResponseMode,
  determineAllowedZones,
  calculateRetrievalParams,
  HIGH_RISK_ER_KEYWORDS,
  MEDIUM_RISK_KEYWORDS,
} = TEST_EXPORTS;

// Test context factory
const createTestContext = (role: AgentContext['role']): AgentContext => ({
  userId: 'test-user',
  role,
  scope: role === 'admin' ? 'all' : role === 'manager' ? 'team' : 'self',
  sensitivityClearance: ['self_visible', 'team_visible'],
  employeeId: 'emp-001',
  permissions: [],
  sessionId: 'sess-001',
  timestamp: new Date().toISOString(),
});

describe('Query Classification', () => {
  describe('determineActor', () => {
    it('should map admin to hr persona', () => {
      expect(determineActor('admin')).toBe('hr');
    });

    it('should map manager to manager persona', () => {
      expect(determineActor('manager')).toBe('manager');
    });

    it('should map team_lead to manager persona', () => {
      expect(determineActor('team_lead')).toBe('manager');
    });

    it('should map employee to employee persona', () => {
      expect(determineActor('employee')).toBe('employee');
    });

    it('should map payroll to hr persona', () => {
      expect(determineActor('payroll')).toBe('hr');
    });
  });

  describe('assessRisk', () => {
    it('should detect critical risk for termination keywords', () => {
      const result = assessRisk('how do i terminate an employee', 'manager');
      expect(result.risk).toBe('critical');
      expect(result.riskDetected).toBe(true);
    });

    it('should detect critical risk for misconduct keywords', () => {
      const result = assessRisk('employee gross misconduct investigation', 'admin');
      expect(result.risk).toBe('critical');
      expect(result.riskDetected).toBe(true);
    });

    it('should detect critical risk for redundancy keywords', () => {
      const result = assessRisk('redundancy process and consultation', 'manager');
      expect(result.risk).toBe('critical');
      expect(result.riskDetected).toBe(true);
    });

    it('should detect high risk for probation keywords', () => {
      const result = assessRisk('probation review period', 'manager');
      expect(result.risk).toBe('high');
      expect(result.riskDetected).toBe(true);
    });

    it('should detect high risk for performance review keywords', () => {
      const result = assessRisk('performance review underperformance', 'manager');
      expect(result.risk).toBe('high');
      expect(result.riskDetected).toBe(true);
    });

    it('should return low risk for employee basic queries', () => {
      const result = assessRisk('how much annual leave do i have', 'employee');
      expect(result.risk).toBe('low');
      expect(result.riskDetected).toBe(false);
    });

    it('should return medium risk for manager general queries', () => {
      const result = assessRisk('team leave calendar', 'manager');
      expect(result.risk).toBe('medium');
      expect(result.riskDetected).toBe(false);
    });
  });

  describe('determineIntent', () => {
    it('should classify policy lookup intent', () => {
      const rules: string[] = [];
      const intent = determineIntent('what is the annual leave policy', rules);
      expect(intent).toBe('policy_lookup');
    });

    it('should classify drafting support intent', () => {
      const rules: string[] = [];
      const intent = determineIntent('draft a warning notice to employee', rules);
      expect(intent).toBe('drafting_support');
    });

    it('should classify procedural help intent', () => {
      const rules: string[] = [];
      const intent = determineIntent('how do i process a leave request', rules);
      expect(intent).toBe('procedural_help');
    });

    it('should classify manager guidance intent', () => {
      const rules: string[] = [];
      const intent = determineIntent('my team supervisor managing staff reviews', rules);
      expect(intent).toBe('manager_guidance');
    });

    it('should classify template lookup intent', () => {
      const rules: string[] = [];
      const intent = determineIntent('onboarding checklist sample template form', rules);
      expect(intent).toBe('template_lookup');
    });

    it('should default to policy lookup for unknown queries', () => {
      const rules: string[] = [];
      const intent = determineIntent('random query about something', rules);
      expect(intent).toBe('policy_lookup');
    });
  });

  describe('determineDomain', () => {
    it('should detect leave domain', () => {
      const rules: string[] = [];
      const domain = determineDomain('annual leave sick days', rules);
      expect(domain).toBe('leave');
    });

    it('should detect probation domain', () => {
      const rules: string[] = [];
      const domain = determineDomain('probation period review', rules);
      expect(domain).toBe('probation');
    });

    it('should detect termination domain', () => {
      const rules: string[] = [];
      const domain = determineDomain('notice period resignation', rules);
      expect(domain).toBe('termination');
    });

    it('should detect redundancy domain', () => {
      const rules: string[] = [];
      const domain = determineDomain('redundancy process', rules);
      expect(domain).toBe('redundancy');
    });

    it('should detect performance domain', () => {
      const rules: string[] = [];
      const domain = determineDomain('performance review pip', rules);
      expect(domain).toBe('performance');
    });

    it('should default to general domain for unknown queries', () => {
      const rules: string[] = [];
      const domain = determineDomain('something completely unrelated', rules);
      expect(domain).toBe('general');
    });
  });

  describe('determineJurisdiction', () => {
    it('should detect NSW jurisdiction', () => {
      expect(determineJurisdiction('nsw employment law')).toBe('NSW');
      expect(determineJurisdiction('new south wales legislation')).toBe('NSW');
      expect(determineJurisdiction('sydney office policy')).toBe('NSW');
    });

    it('should detect VIC jurisdiction', () => {
      expect(determineJurisdiction('vic workplace laws')).toBe('VIC');
      expect(determineJurisdiction('victoria employment')).toBe('VIC');
    });

    it('should detect AU jurisdiction', () => {
      expect(determineJurisdiction('australia federal law')).toBe('AU');
      expect(determineJurisdiction('fair work act')).toBe('AU');
    });

    it('should return unknown for queries without jurisdiction indicators', () => {
      expect(determineJurisdiction('annual leave policy')).toBe('unknown');
    });
  });

  describe('determineResponseMode', () => {
    it('should escalate critical risk queries', () => {
      const mode = determineResponseMode('policy_lookup', 'critical', 'leave');
      expect(mode).toBe('escalate');
    });

    it('should escalate high risk termination queries', () => {
      const mode = determineResponseMode('high_risk_er', 'high', 'termination');
      expect(mode).toBe('escalate');
    });

    it('should use cite_only for other high risk queries', () => {
      const mode = determineResponseMode('policy_lookup', 'high', 'general');
      expect(mode).toBe('cite_only');
    });

    it('should use draft_support for drafting queries', () => {
      const mode = determineResponseMode('drafting_support', 'medium', 'general');
      expect(mode).toBe('draft_support');
    });

    it('should use checklist for procedural help', () => {
      const mode = determineResponseMode('procedural_help', 'low', 'systems');
      expect(mode).toBe('checklist');
    });

    it('should use answer for standard policy lookups', () => {
      const mode = determineResponseMode('policy_lookup', 'low', 'leave');
      expect(mode).toBe('answer');
    });
  });

  describe('determineAllowedZones', () => {
    it('should give employees access to basic zones', () => {
      const zones = determineAllowedZones('policy_lookup', 'low', 'employee');
      expect(zones).toContain('authoritative_policy');
      expect(zones).toContain('system_help');
      expect(zones).not.toContain('legal_playbook');
    });

    it('should give managers additional zones', () => {
      const zones = determineAllowedZones('manager_guidance', 'medium', 'manager');
      expect(zones).toContain('authoritative_policy');
      expect(zones).toContain('workflow_sop');
      expect(zones).toContain('templates_precedents');
      expect(zones).not.toContain('legal_playbook');
    });

    it('should give admins access to legal playbooks', () => {
      const zones = determineAllowedZones('hr_guidance', 'low', 'admin');
      expect(zones).toContain('legal_playbook');
    });

    it('should add legal playbook for high risk ER queries', () => {
      const zones = determineAllowedZones('high_risk_er', 'high', 'manager');
      expect(zones).toContain('legal_playbook');
    });
  });

  describe('calculateRetrievalParams', () => {
    it('should use fast lane for simple policy lookups', () => {
      const params = calculateRetrievalParams('policy_lookup', 'low', 'systems');
      expect(params.retrievalDepth).toBe('fast');
      expect(params.maxContextBudget).toBe(2000);
    });

    it('should use deep lane for high risk queries', () => {
      const params = calculateRetrievalParams('policy_lookup', 'critical', 'termination');
      expect(params.retrievalDepth).toBe('deep');
      expect(params.maxContextBudget).toBe(6000);
    });

    it('should use deep lane for complex domains', () => {
      const params = calculateRetrievalParams('hr_guidance', 'medium', 'redundancy');
      expect(params.retrievalDepth).toBe('deep');
      expect(params.maxContextBudget).toBe(6000);
    });

    it('should use standard lane for general queries', () => {
      const params = calculateRetrievalParams('manager_guidance', 'medium', 'leave');
      expect(params.retrievalDepth).toBe('standard');
      expect(params.maxContextBudget).toBe(4000);
    });
  });
});

describe('classifyQuery integration', () => {
  it('should classify a simple leave query', () => {
    const context = createTestContext('employee');
    const result = classifyQuery('how much annual leave do i get', context);

    expect(result.classification.intent).toBe('policy_lookup');
    expect(result.classification.domain).toBe('leave');
    expect(result.classification.risk).toBe('low');
    expect(result.classification.responseMode).toBe('answer');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify a termination query as high risk', () => {
    const context = createTestContext('manager');
    const result = classifyQuery('terminate an employee for gross misconduct', context);

    expect(result.classification.intent).toBe('policy_lookup');  // No procedural pattern matched
    expect(result.classification.domain).toBe('termination');  // "terminate" keyword matches termination domain
    expect(result.classification.risk).toBe('critical');
    expect(result.classification.responseMode).toBe('escalate');
    expect(result.classification.requiredVerification).toBe(true);
  });

  it('should classify a drafting request', () => {
    const context = createTestContext('manager');
    const result = classifyQuery('draft a warning letter to employee', context);

    expect(result.classification.intent).toBe('drafting_support');
    expect(result.classification.responseMode).toBe('draft_support');
    expect(result.classification.allowedZones).toContain('templates_precedents');
  });

  it('should detect NSW jurisdiction', () => {
    const context = createTestContext('manager');
    const result = classifyQuery('nsw leave entitlements', context);

    expect(result.classification.jurisdiction).toBe('NSW');
  });

  it('should set appropriate zones for admin queries', () => {
    const context = createTestContext('admin');
    const result = classifyQuery('redundancy process and legal requirements', context);

    expect(result.classification.allowedZones).toContain('legal_playbook');
    expect(result.classification.allowedZones).toContain('authoritative_policy');
  });

  it('should require verification for high risk queries', () => {
    const context = createTestContext('admin');
    const result = classifyQuery('disciplinary procedure for gross misconduct', context);

    expect(result.classification.requiredVerification).toBe(true);
    expect(result.classification.risk).toBe('critical');
  });

  it('should use deep retrieval for complex HR matters', () => {
    const context = createTestContext('admin');
    const result = classifyQuery('performance improvement plan procedure', context);

    expect(result.classification.retrievalDepth).toBe('deep');
    expect(result.classification.maxContextBudget).toBe(6000);
  });
});

describe('HIGH_RISK_ER_KEYWORDS', () => {
  it('should include termination keywords', () => {
    expect(HIGH_RISK_ER_KEYWORDS).toContain('terminate');
    expect(HIGH_RISK_ER_KEYWORDS).toContain('termination');
    expect(HIGH_RISK_ER_KEYWORDS).toContain('fire');
  });

  it('should include misconduct keywords', () => {
    expect(HIGH_RISK_ER_KEYWORDS).toContain('misconduct');
    expect(HIGH_RISK_ER_KEYWORDS).toContain('gross misconduct');
    expect(HIGH_RISK_ER_KEYWORDS).toContain('disciplinary');
  });

  it('should include legal action keywords', () => {
    expect(HIGH_RISK_ER_KEYWORDS).toContain('unfair dismissal');
    expect(HIGH_RISK_ER_KEYWORDS).toContain('legal action');
    expect(HIGH_RISK_ER_KEYWORDS).toContain('tribunal');
  });
});

describe('MEDIUM_RISK_KEYWORDS', () => {
  it('should include probation keywords', () => {
    expect(MEDIUM_RISK_KEYWORDS).toContain('probation');
    expect(MEDIUM_RISK_KEYWORDS).toContain('probationary');
  });

  it('should include performance keywords', () => {
    expect(MEDIUM_RISK_KEYWORDS).toContain('performance review');
    expect(MEDIUM_RISK_KEYWORDS).toContain('underperformance');
  });

  it('should include visa keywords', () => {
    expect(MEDIUM_RISK_KEYWORDS).toContain('visa');
    expect(MEDIUM_RISK_KEYWORDS).toContain('sponsorship');
    expect(MEDIUM_RISK_KEYWORDS).toContain('482');
  });
});
