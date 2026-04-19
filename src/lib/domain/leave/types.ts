/**
 * Leave Domain Types
 */

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'personal' | 'parental' | 'bereavement' | 'unpaid' | 'other';
  entitlementDays: number;
  takenDays: number;
  pendingDays: number;
  remainingDays: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'personal' | 'parental' | 'bereavement' | 'unpaid' | 'other';
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
