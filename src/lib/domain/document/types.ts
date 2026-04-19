/**
 * Document Domain Types
 */

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  sourceId: string;
  sourcePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: 'contract' | 'visa' | 'certification' | 'id' | 'medical' | 'tax' | 'performance' | 'other';
  status: 'active' | 'expired' | 'expiring' | 'missing';
  uploadedAt: string;
  expiresAt: string | null;
  extractedData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRequirement {
  id: string;
  category: string;
  employmentTypes: string[];
  required: boolean;
  expires: boolean;
  expirationWarningDays: number | null;
  createdAt: string;
  updatedAt: string;
}

// Re-export database types for agent layer use
export type { PolicyDocument, PolicyChunk } from '@/types/database';
