/**
 * Communication Domain Types
 */

export interface CommunicationTemplate {
  id: string;
  name: string;
  category: string;
  channel: 'email' | 'slack' | 'teams';
  subject: string | null;
  body: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationDraft {
  id: string;
  templateId: string | null;
  channel: 'email' | 'slack' | 'teams';
  recipientId: string;
  subject: string | null;
  body: string;
  variables: Record<string, string>;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'failed';
  approvedBy: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}
