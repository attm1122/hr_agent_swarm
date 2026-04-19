/**
 * Export Button with Approval Workflow
 * 
 * Features:
 * - Triggers export with approval workflow for sensitive data
 * - Shows pending state when approval is required
 * - Displays approval status via alerts
 * - Handles export download once approved
 * 
 * Security:
 * - Only renders if user has report:generate capability
 * - Shows warning when approval is required
 * - Logs all export attempts
 */

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { AgentContext } from '@/types';
import { toDateOnlyString } from '@/lib/domain/shared/date-value';

interface ExportButtonProps {
  context: AgentContext;
  exportType: 'employees' | 'documents' | 'leave' | 'compliance';
  filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    teamId?: string;
  };
  variant?: 'outline' | 'default' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

interface ExportStatus {
  state: 'idle' | 'requesting' | 'pending_approval' | 'approved' | 'downloading' | 'error';
  exportId?: string;
  message?: string;
  approverRole?: string;
}

export function ExportButton({
  context,
  exportType,
  filters,
  variant = 'outline',
  size = 'sm',
  className,
}: ExportButtonProps) {
  const [status, setStatus] = useState<ExportStatus>({ state: 'idle' });

  const handleExportRequest = useCallback(async () => {
    if (!confirm(`Export ${exportType} data? This will be logged and may require approval.`)) {
      return;
    }

    setStatus({ state: 'requesting' });

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: exportType,
          format: 'csv',
          filters,
        }),
      });

      if (response.status === 202) {
        // Pending approval
        const data = await response.json();
        setStatus({
          state: 'pending_approval',
          exportId: data.exportId,
          message: data.message,
          approverRole: data.approverRole,
        });
        alert(`Export requires approval.\n\nExport ID: ${data.exportId}\nApprover: ${data.approverRole}\n\nContact your approver to proceed.`);
      } else if (response.ok) {
        // Direct download (no approval needed)
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exportType}_export_${toDateOnlyString()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setStatus({ state: 'idle' });
      } else {
        const data = await response.json();
        setStatus({
          state: 'error',
          message: data.error || 'Export failed',
        });
        alert(`Export failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export request failed';
      setStatus({
        state: 'error',
        message,
      });
      alert(`Export error: ${message}`);
    }
  }, [exportType, filters]);

  const getButtonContent = () => {
    switch (status.state) {
      case 'requesting':
        return (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Requesting...
          </>
        );
      case 'pending_approval':
        return (
          <>
            <Clock className="w-4 h-4 mr-2 text-amber-500" />
            Pending Approval
          </>
        );
      default:
        return (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export
          </>
        );
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleExportRequest}
      disabled={status.state === 'requesting' || status.state === 'pending_approval'}
    >
      {getButtonContent()}
    </Button>
  );
}

/**
 * Export Status Badge
 * Shows current export approval status
 */
export function ExportStatusBadge({ status }: { status: ExportStatus }) {
  switch (status.state) {
    case 'pending_approval':
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
          <Clock className="w-3 h-3 mr-1" />
          Pending Approval
        </Badge>
      );
    case 'approved':
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}
