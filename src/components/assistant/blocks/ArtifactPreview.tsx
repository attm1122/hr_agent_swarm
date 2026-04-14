'use client';

import { Download, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UIAction } from '@/lib/ai-os';
import type { ArtifactPreviewBlock, TableColumn } from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExpiresAt(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `expires in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `expires in ${hours}h`;
  return `expires in ${Math.floor(hours / 24)}d`;
}

function formatCell(
  value: string | number | null,
  format?: TableColumn['format'],
): React.ReactNode {
  if (value == null) return '\u2014';
  switch (format) {
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'number':
      return Number(value).toLocaleString();
    case 'currency':
      return `$${Number(value).toLocaleString()}`;
    case 'badge':
      return <Badge variant="secondary">{String(value)}</Badge>;
    default:
      return String(value);
  }
}

export default function ArtifactPreview({
  block,
}: BlockComponentProps<ArtifactPreviewBlock>) {
  return (
    <Card className="rounded-xl border bg-white shadow-sm dark:bg-gray-900">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <FileText className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-base font-semibold">
              {block.filename}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{block.mimeType}</span>
              {block.sizeBytes != null && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>{formatBytes(block.sizeBytes)}</span>
                </>
              )}
              {block.rowCount != null && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>{block.rowCount.toLocaleString()} rows</span>
                </>
              )}
              {block.expiresAt && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>{formatExpiresAt(block.expiresAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Preview table */}
        {block.previewColumns &&
          block.previewRows &&
          block.previewRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                    {block.previewColumns.map((col) => (
                      <th
                        key={col.key}
                        className="px-2 py-1.5 text-left font-medium text-muted-foreground"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.previewRows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className={`border-b border-gray-100 dark:border-gray-800 ${
                        rowIdx % 2 === 1
                          ? 'bg-gray-50/50 dark:bg-gray-800/30'
                          : ''
                      }`}
                    >
                      {block.previewColumns!.map((col) => (
                        <td key={col.key} className="px-2 py-1.5 text-foreground">
                          {formatCell(row[col.key], col.format)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {/* Download button */}
        <a href={block.href} target="_blank" rel="noopener noreferrer">
          <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600">
            <Download className="size-4" />
            Download
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
