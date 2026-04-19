import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionQueue } from './ActionQueue';
import type { ActionItem } from '@/types';

const mockItems: ActionItem[] = [
  {
    id: 'test-1',
    type: 'leave_request',
    title: 'Leave request from John Doe',
    description: 'Annual leave: Apr 15 to Apr 20 (5 days)',
    priority: 'medium',
    dueDate: '2025-04-15',
    assignee: 'john.doe@company.com',
    entityType: 'leave',
    entityId: 'lr-test-1',
  },
  {
    id: 'test-2',
    type: 'expiring_document',
    title: 'Document expiring: Cert.pdf',
    description: 'Jane Smith - expires 2025-05-09',
    priority: 'high',
    dueDate: '2025-05-09',
    entityType: 'document',
    entityId: 'doc-test-1',
  },
  {
    id: 'test-3',
    type: 'milestone',
    title: 'Work Visa Expiry',
    description: 'Bob Wilson - 2025-06-01',
    priority: 'critical',
    dueDate: '2025-06-01',
    entityType: 'milestone',
    entityId: 'ms-test-1',
  },
  {
    id: 'test-4',
    type: 'compliance',
    title: 'Compliance check required',
    description: 'Annual compliance review',
    priority: 'low',
    entityType: 'compliance',
    entityId: 'comp-test-1',
  },
];

describe('ActionQueue', () => {
  it('renders empty state when no items', () => {
    render(<ActionQueue items={[]} />);
    expect(screen.getByText('All caught up!')).toBeInTheDocument();
    expect(screen.getByText('No pending actions requiring your attention right now.')).toBeInTheDocument();
  });

  it('renders default title', () => {
    render(<ActionQueue items={mockItems} />);
    expect(screen.getByText('Action Queue')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ActionQueue items={mockItems} title="My Queue" />);
    expect(screen.getByText('My Queue')).toBeInTheDocument();
  });

  it('renders custom title for empty state', () => {
    render(<ActionQueue items={[]} title="Custom Empty" />);
    expect(screen.getByText('Custom Empty')).toBeInTheDocument();
  });

  it('shows pending count badge', () => {
    render(<ActionQueue items={mockItems} />);
    expect(screen.getByText('4 pending')).toBeInTheDocument();
  });

  it('renders all action items', () => {
    render(<ActionQueue items={mockItems} />);
    expect(screen.getByText('Leave request from John Doe')).toBeInTheDocument();
    expect(screen.getByText('Document expiring: Cert.pdf')).toBeInTheDocument();
    expect(screen.getByText('Work Visa Expiry')).toBeInTheDocument();
    expect(screen.getByText('Compliance check required')).toBeInTheDocument();
  });

  it('renders descriptions', () => {
    render(<ActionQueue items={mockItems} />);
    expect(screen.getByText('Annual leave: Apr 15 to Apr 20 (5 days)')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith - expires 2025-05-09')).toBeInTheDocument();
  });

  it('renders priority badges', () => {
    render(<ActionQueue items={mockItems} />);
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('renders due dates', () => {
    render(<ActionQueue items={mockItems} />);
    // Items with due dates should show formatted dates
    const dueTexts = screen.getAllByText(/Due:/);
    expect(dueTexts.length).toBe(3); // 3 items have dueDate, 1 does not
  });

  it('renders review buttons for each item', () => {
    render(<ActionQueue items={mockItems} />);
    const reviewButtons = screen.getAllByText('Review');
    expect(reviewButtons.length).toBe(4);
  });

  it('renders single item correctly', () => {
    render(<ActionQueue items={[mockItems[0]]} />);
    expect(screen.getByText('1 pending')).toBeInTheDocument();
    expect(screen.getByText('Leave request from John Doe')).toBeInTheDocument();
  });

  it('does not show due date when not provided', () => {
    const itemWithoutDue: ActionItem[] = [{
      id: 'no-due',
      type: 'compliance',
      title: 'No due date item',
      description: 'No due date',
      priority: 'low',
      entityType: 'compliance',
      entityId: 'comp-no-due',
    }];
    render(<ActionQueue items={itemWithoutDue} />);
    expect(screen.queryByText(/Due:/)).not.toBeInTheDocument();
  });

  it('falls back to default icon for unknown action type', () => {
    const unknownTypeItem: ActionItem[] = [{
      id: 'unknown-type',
      type: 'some_unknown_type',
      title: 'Unknown type action',
      description: 'Testing fallback icon',
      priority: 'medium',
      entityType: 'unknown',
      entityId: 'u-1',
    }];
    render(<ActionQueue items={unknownTypeItem} />);
    expect(screen.getByText('Unknown type action')).toBeInTheDocument();
  });
});
