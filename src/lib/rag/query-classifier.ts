/**
 * Query Classification Service
 * 
 * Determines retrieval strategy and safety controls based on query analysis.
 * 
 * Architecture:
 * - Pure domain logic - no LLM dependency for classification
 * - Deterministic rule-based with keyword/phrase matching
 * - Fast classification for routing decisions
 * 
 * Security:
 * - Classification is logged for audit
 * - Risk level drives verification requirements
 * - No sensitive content in classification logic
 */

import type {
  QueryClassification,
  QueryIntent,
  QueryDomain,
  RiskLevel,
  Jurisdiction,
  ActorPersona,
  ResponseMode,
  KnowledgeZone,
} from './types';
import type { AgentContext } from '@/types';

// ============================================
// Classification Rules
// ============================================

interface ClassificationRule {
  keywords: string[];
  intent?: QueryIntent;
  domain?: QueryDomain;
  risk?: RiskLevel;
  boostZones?: KnowledgeZone[];
  requireVerification?: boolean;
  responseMode?: ResponseMode;
}

// High-risk ER keywords that trigger escalation
const HIGH_RISK_ER_KEYWORDS = [
  'terminate', 'termination', 'fire', 'firing', 'dismiss', 'dismissal',
  'redundancy', 'redundant', 'layoff', 'lay off', 'let go',
  'misconduct', 'gross misconduct', 'disciplinary', 'disciplinary action',
  'investigation', 'formal warning', 'final warning', 'pip', 'performance improvement',
  'grievance', 'complaint', 'harassment', 'bullying', 'discrimination',
  'unfair dismissal', 'constructive dismissal', 'workplace conflict',
  'legal action', 'lawsuit', 'tribunal', 'fair work', 'adverse action',
  'workers compensation', 'compo claim', 'injury claim',
];

// Medium-risk keywords
const MEDIUM_RISK_KEYWORDS = [
  'probation', 'probationary', 'performance review', 'underperformance',
  'salary increase', 'pay rise', 'promotion', 'demotion',
  'leave without pay', 'unpaid leave', 'extended leave',
  'visa', 'sponsorship', 'work rights', '482', '186', '491',
  'redundancy consultation', 'consultation period',
  'notice period', 'resignation', 'resign', 'quit',
];

// Domain classification rules
const DOMAIN_RULES: ClassificationRule[] = [
  { keywords: ['leave', 'holiday', 'vacation', 'sick leave', 'personal leave'], domain: 'leave' },
  { keywords: ['probation', 'probationary period', 'probation review'], domain: 'probation' },
  { keywords: ['redundancy', 'redundant', 'layoff', 'restructure'], domain: 'redundancy' },
  { keywords: ['terminate', 'termination', 'fire', 'dismiss', 'resign'], domain: 'termination' },
  { keywords: ['misconduct', 'disciplinary', 'warning', 'breach'], domain: 'misconduct' },
  { keywords: ['grievance', 'complaint', 'dispute', 'conflict'], domain: 'grievance' },
  { keywords: ['performance', 'underperformance', 'review', 'pip'], domain: 'performance' },
  { keywords: ['onboard', 'new hire', 'induction', 'first day'], domain: 'onboarding' },
  { keywords: ['offboard', 'exit', 'resignation', 'final pay', 'notice'], domain: 'offboarding' },
  { keywords: ['visa', 'sponsorship', '482', '186', 'work rights', 'immigration'], domain: 'visa' },
  { keywords: ['pay', 'salary', 'wage', 'overtime', 'penalty rates'], domain: 'payroll' },
  { keywords: ['policy', 'procedure', 'guideline', 'standard'], domain: 'policies' },
  { keywords: ['system', 'software', 'login', 'access', 'it help'], domain: 'systems' },
];

// Intent classification rules (order matters - first match wins)
const INTENT_RULES: ClassificationRule[] = [
  {
    keywords: ['what is', 'what are', 'how much', 'how many', 'when', 'where', 'who', 'can i', 'am i entitled'],
    intent: 'policy_lookup',
  },
  // Template lookup must come before drafting_support to avoid misclassification
  {
    keywords: ['template', 'form', 'checklist', 'precedent', 'sample'],
    intent: 'template_lookup',
    boostZones: ['templates_precedents'],
  },
  {
    keywords: ['draft', 'write', 'prepare', 'create', 'generate', 'letter', 'email', 'notice'],
    intent: 'drafting_support',
    responseMode: 'draft_support',
  },
  {
    keywords: ['how do i', 'how to', 'steps', 'process', 'procedure', 'guide', 'walkthrough'],
    intent: 'procedural_help',
  },
  {
    keywords: ['manager', 'supervisor', 'lead', 'team lead', 'managing', 'my team'],
    intent: 'manager_guidance',
    boostZones: ['workflow_sop', 'authoritative_policy'],
  },
  {
    keywords: ['hr guidance', 'hr advice', 'hr process', 'human resources'],
    intent: 'hr_guidance',
    boostZones: ['legal_playbook', 'authoritative_policy'],
  },
];

// Jurisdiction indicators
const JURISDICTION_INDICATORS: Record<Jurisdiction, string[]> = {
  AU: ['australia', 'federal', 'fair work act', 'nationally'],
  NSW: ['nsw', 'new south wales', 'sydney', 'industrial relations act nsw'],
  VIC: ['vic', 'victoria', 'melbourne'],
  QLD: ['qld', 'queensland', 'brisbane'],
  WA: ['wa', 'western australia', 'perth'],
  SA: ['sa', 'south australia', 'adelaide'],
  TAS: ['tas', 'tasmania', 'hobart'],
  ACT: ['act', 'canberra', 'australian capital territory'],
  NT: ['nt', 'northern territory', 'darwin'],
  NZ: ['nz', 'new zealand', 'wellington', 'auckland'],
  global: ['global', 'international', 'worldwide', 'all regions'],
  unknown: [],
};

// ============================================
// Classification Service
// ============================================

export interface ClassificationResult {
  classification: QueryClassification;
  matchedRules: string[];
  confidence: number;
}

/**
 * Classify a query to determine retrieval strategy
 * 
 * Pure deterministic logic - no LLM calls for classification
 * Fast execution for routing decisions (< 10ms)
 */
export function classifyQuery(
  query: string,
  context: AgentContext
): ClassificationResult {
  const normalizedQuery = query.toLowerCase();
  const matchedRules: string[] = [];

  // 1. Determine Actor/Persona from context
  const actor = determineActor(context.role);

  // 2. Detect High-Risk ER (highest priority)
  const { risk, riskDetected } = assessRisk(normalizedQuery, context.role);
  if (riskDetected) {
    matchedRules.push('high_risk_er_detection');
  }

  // 3. Determine Intent
  const intent = determineIntent(normalizedQuery, matchedRules);

  // 4. Determine Domain
  const domain = determineDomain(normalizedQuery, matchedRules);

  // 5. Determine Jurisdiction
  const jurisdiction = determineJurisdiction(normalizedQuery);

  // 6. Determine Response Mode
  const responseMode = determineResponseMode(intent, risk, domain);

  // 7. Determine Allowed Zones
  const allowedZones = determineAllowedZones(intent, risk, context.role);

  // 8. Calculate context budget and retrieval depth
  const { maxContextBudget, retrievalDepth } = calculateRetrievalParams(
    intent,
    risk,
    domain
  );

  // 9. Determine verification requirement
  const requiredVerification = risk === 'high' ||
    risk === 'critical' ||
    (intent === 'high_risk_er') ||
    (domain === 'termination' || domain === 'redundancy' || domain === 'misconduct');

  const classification: QueryClassification = {
    intent,
    domain,
    risk,
    jurisdiction,
    actor,
    responseMode,
    allowedZones,
    requiredVerification,
    maxContextBudget,
    retrievalDepth,
  };

  // Calculate confidence based on rule matches
  const confidence = calculateConfidence(
    matchedRules.length,
    intent,
    domain,
    risk
  );

  return {
    classification,
    matchedRules,
    confidence,
  };
}

/**
 * Determine actor persona from role
 */
function determineActor(role: AgentContext['role']): ActorPersona {
  switch (role) {
    case 'admin':
      return 'hr';  // Admin is treated as HR for RAG purposes
    case 'manager':
      return 'manager';
    case 'team_lead':
      return 'manager';  // Team lead treated as manager
    case 'employee':
      return 'employee';
    case 'payroll':
      return 'hr';  // Payroll treated as HR
    default:
      return 'employee';
  }
}

/**
 * Assess risk level based on query content
 */
function assessRisk(
  normalizedQuery: string,
  role: AgentContext['role']
): { risk: RiskLevel; riskDetected: boolean } {
  // Check for critical/high-risk ER terms
  for (const keyword of HIGH_RISK_ER_KEYWORDS) {
    if (normalizedQuery.includes(keyword)) {
      return { risk: 'critical', riskDetected: true };
    }
  }

  // Check for medium-risk terms
  for (const keyword of MEDIUM_RISK_KEYWORDS) {
    if (normalizedQuery.includes(keyword)) {
      return { risk: 'high', riskDetected: true };
    }
  }

  // Lower risk for employees asking basic questions
  if (role === 'employee') {
    return { risk: 'low', riskDetected: false };
  }

  // Default for HR/manager queries
  return { risk: 'medium', riskDetected: false };
}

/**
 * Determine intent from query patterns
 */
function determineIntent(
  normalizedQuery: string,
  matchedRules: string[]
): QueryIntent {
  for (const rule of INTENT_RULES) {
    for (const keyword of rule.keywords) {
      if (normalizedQuery.includes(keyword)) {
        if (rule.intent) {
          matchedRules.push(`intent:${rule.intent}`);
          return rule.intent;
        }
      }
    }
  }

  // Default to policy lookup
  return 'policy_lookup';
}

/**
 * Determine domain from query content
 */
function determineDomain(
  normalizedQuery: string,
  matchedRules: string[]
): QueryDomain {
  for (const rule of DOMAIN_RULES) {
    for (const keyword of rule.keywords) {
      if (normalizedQuery.includes(keyword)) {
        if (rule.domain) {
          matchedRules.push(`domain:${rule.domain}`);
          return rule.domain;
        }
      }
    }
  }

  // Default to general
  return 'general';
}

/**
 * Determine jurisdiction from query indicators
 */
function determineJurisdiction(normalizedQuery: string): Jurisdiction {
  for (const [jurisdiction, indicators] of Object.entries(JURISDICTION_INDICATORS)) {
    for (const indicator of indicators) {
      if (normalizedQuery.includes(indicator)) {
        return jurisdiction as Jurisdiction;
      }
    }
  }

  return 'unknown';
}

/**
 * Determine response mode based on intent and risk
 */
function determineResponseMode(
  intent: QueryIntent,
  risk: RiskLevel,
  domain: QueryDomain
): ResponseMode {
  // Critical risk always escalates
  if (risk === 'critical') {
    return 'escalate';
  }

  // High risk ER scenarios
  if (intent === 'high_risk_er' || risk === 'high') {
    if (domain === 'termination' || domain === 'redundancy' || domain === 'misconduct') {
      return 'escalate';
    }
    return 'cite_only';
  }

  // Drafting support requests
  if (intent === 'drafting_support') {
    return 'draft_support';
  }

  // Procedural help
  if (intent === 'procedural_help') {
    return 'checklist';
  }

  // Default
  return 'answer';
}

/**
 * Determine which knowledge zones are accessible
 */
function determineAllowedZones(
  intent: QueryIntent,
  risk: RiskLevel,
  role: AgentContext['role']
): KnowledgeZone[] {
  const baseZones: KnowledgeZone[] = [
    'authoritative_policy',
    'system_help',
  ];

  // HR roles get additional zones
  if (role === 'admin' || role === 'manager') {
    baseZones.push('workflow_sop');
    baseZones.push('templates_precedents');
  }

  // Only HR/admin get legal playbooks
  if (role === 'admin') {
    baseZones.push('legal_playbook');
  }

  // High-risk ER requires legal playbook access
  if (intent === 'high_risk_er' || risk === 'high' || risk === 'critical') {
    if (!baseZones.includes('legal_playbook')) {
      baseZones.push('legal_playbook');
    }
  }

  // Template lookup
  if (intent === 'template_lookup') {
    if (!baseZones.includes('templates_precedents')) {
      baseZones.push('templates_precedents');
    }
  }

  return baseZones;
}

/**
 * Calculate retrieval parameters based on query characteristics
 */
function calculateRetrievalParams(
  intent: QueryIntent,
  risk: RiskLevel,
  domain: QueryDomain
): { maxContextBudget: number; retrievalDepth: 'fast' | 'standard' | 'deep' } {
  // Fast lane: simple lookups
  const fastLaneIntents: QueryIntent[] = ['policy_lookup', 'procedural_help', 'template_lookup'];
  const fastLaneDomains: QueryDomain[] = ['systems', 'general', 'policies'];

  if (fastLaneIntents.includes(intent) && fastLaneDomains.includes(domain)) {
    return { maxContextBudget: 2000, retrievalDepth: 'fast' };
  }

  // Deep lane: high-risk or complex domains
  const deepLaneDomains: QueryDomain[] = [
    'redundancy', 'termination', 'misconduct', 'grievance', 'performance'
  ];

  if (risk === 'high' || risk === 'critical' || deepLaneDomains.includes(domain)) {
    return { maxContextBudget: 6000, retrievalDepth: 'deep' };
  }

  // Standard lane: everything else
  return { maxContextBudget: 4000, retrievalDepth: 'standard' };
}

/**
 * Calculate classification confidence score
 */
function calculateConfidence(
  matchedRuleCount: number,
  intent: QueryIntent,
  domain: QueryDomain,
  risk: RiskLevel
): number {
  let confidence = 0.5;  // Base confidence

  // Boost for matched rules
  confidence += Math.min(matchedRuleCount * 0.1, 0.3);

  // Boost for non-default classifications
  if (intent !== 'policy_lookup') confidence += 0.1;
  if (domain !== 'general') confidence += 0.1;
  if (risk !== 'low') confidence += 0.05;

  // Cap at 0.95 (never 100% certain)
  return Math.min(confidence, 0.95);
}

// ============================================
// Export utilities for testing
// ============================================

export const TEST_EXPORTS = {
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
};
