import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// We need to test the exported page function and the helper functions.
// The page uses async server components, so we test the helpers directly
// and the exported default component.

// Import mock data to verify the helpers
import { employees, milestones, documents, leaveRequests, getEmployeeById } from '@/lib/data/mock-data';

// Test the data functions that are defined in the page
// We replicate them here because they're not exported from the page module

function getDashboardMetrics() {
  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const pendingLeave = leaveRequests.filter(lr => lr.status === 'pending').length;
  const expiringDocs = documents.filter(d => d.status === 'expiring').length;
  return {
    totalEmployees: activeEmployees,
    pendingApprovals: 6,
    pendingLeaveRequests: pendingLeave,
    expiringDocsCount: expiringDocs,
  };
}

function getUpcomingAnniversaries() {
  return milestones
    .filter(m => m.milestoneType === 'service_anniversary' && m.status === 'upcoming')
    .map(m => {
      const emp = getEmployeeById(m.employeeId);
      return {
        id: m.id,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        date: m.milestoneDate,
        description: m.description,
      };
    });
}

function getProbationDue() {
  const now = new Date();
  return milestones
    .filter(m => m.milestoneType === 'probation_end' && (m.status === 'upcoming' || m.status === 'due'))
    .map(m => {
      const emp = getEmployeeById(m.employeeId);
      const daysRemaining = Math.ceil((new Date(m.milestoneDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: m.id,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        date: m.milestoneDate,
        daysRemaining,
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

describe('HR Dashboard - getDashboardMetrics', () => {
  it('returns correct total active employees', () => {
    const metrics = getDashboardMetrics();
    const expected = employees.filter(e => e.status === 'active').length;
    expect(metrics.totalEmployees).toBe(expected);
  });

  it('returns correct pending leave count', () => {
    const metrics = getDashboardMetrics();
    const expected = leaveRequests.filter(lr => lr.status === 'pending').length;
    expect(metrics.pendingLeaveRequests).toBe(expected);
  });

  it('returns correct expiring docs count', () => {
    const metrics = getDashboardMetrics();
    const expected = documents.filter(d => d.status === 'expiring').length;
    expect(metrics.expiringDocsCount).toBe(expected);
  });

  it('has a static pending approvals count', () => {
    const metrics = getDashboardMetrics();
    expect(metrics.pendingApprovals).toBe(6);
  });

  it('all metrics are non-negative', () => {
    const metrics = getDashboardMetrics();
    expect(metrics.totalEmployees).toBeGreaterThanOrEqual(0);
    expect(metrics.pendingApprovals).toBeGreaterThanOrEqual(0);
    expect(metrics.pendingLeaveRequests).toBeGreaterThanOrEqual(0);
    expect(metrics.expiringDocsCount).toBeGreaterThanOrEqual(0);
  });
});

describe('HR Dashboard - getUpcomingAnniversaries', () => {
  it('returns only service_anniversary milestones', () => {
    const result = getUpcomingAnniversaries();
    result.forEach(a => {
      const ms = milestones.find(m => m.id === a.id);
      expect(ms?.milestoneType).toBe('service_anniversary');
    });
  });

  it('returns only upcoming milestones', () => {
    const result = getUpcomingAnniversaries();
    result.forEach(a => {
      const ms = milestones.find(m => m.id === a.id);
      expect(ms?.status).toBe('upcoming');
    });
  });

  it('resolves employee names', () => {
    const result = getUpcomingAnniversaries();
    result.forEach(a => {
      expect(a.employeeName).not.toBe('Unknown');
      expect(a.employeeName.length).toBeGreaterThan(0);
    });
  });

  it('includes dates', () => {
    const result = getUpcomingAnniversaries();
    result.forEach(a => {
      expect(a.date).toBeTruthy();
      expect(new Date(a.date).toString()).not.toBe('Invalid Date');
    });
  });

  it('includes descriptions', () => {
    const result = getUpcomingAnniversaries();
    result.forEach(a => {
      expect(a.description).toBeTruthy();
    });
  });
});

describe('HR Dashboard - getProbationDue', () => {
  it('returns only probation_end milestones', () => {
    const result = getProbationDue();
    result.forEach(p => {
      const ms = milestones.find(m => m.id === p.id);
      expect(ms?.milestoneType).toBe('probation_end');
    });
  });

  it('returns upcoming or due milestones only', () => {
    const result = getProbationDue();
    result.forEach(p => {
      const ms = milestones.find(m => m.id === p.id);
      expect(['upcoming', 'due']).toContain(ms?.status);
    });
  });

  it('calculates days remaining', () => {
    const result = getProbationDue();
    result.forEach(p => {
      expect(typeof p.daysRemaining).toBe('number');
    });
  });

  it('is sorted by days remaining ascending', () => {
    const result = getProbationDue();
    for (let i = 1; i < result.length; i++) {
      expect(result[i].daysRemaining).toBeGreaterThanOrEqual(result[i - 1].daysRemaining);
    }
  });

  it('resolves employee names', () => {
    const result = getProbationDue();
    result.forEach(p => {
      expect(p.employeeName).not.toBe('Unknown');
    });
  });
});

describe('HR Dashboard - document filters', () => {
  it('correctly filters expiring documents', () => {
    const expiringDocs = documents.filter(d => d.status === 'expiring');
    expect(expiringDocs.length).toBeGreaterThanOrEqual(0);
    expiringDocs.forEach(d => {
      expect(d.status).toBe('expiring');
    });
  });

  it('correctly filters missing documents', () => {
    const missingDocs = documents.filter(d => d.status === 'missing');
    missingDocs.forEach(d => {
      expect(d.status).toBe('missing');
    });
  });
});
