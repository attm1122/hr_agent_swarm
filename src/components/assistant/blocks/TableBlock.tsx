'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { UIAction } from '@/lib/ai-os';
import type {
  TableBlock as TableBlockType,
  TableColumn,
} from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
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

function alignClass(align?: TableColumn['align']): string {
  switch (align) {
    case 'right':
      return 'text-right';
    case 'center':
      return 'text-center';
    default:
      return 'text-left';
  }
}

export default function TableBlock({
  block,
}: BlockComponentProps<TableBlockType>) {
  return (
    <Card className="rounded-xl border bg-white shadow-sm dark:bg-gray-900">
      {block.title && (
        <CardHeader>
          <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
          {block.description && (
            <p className="text-sm text-muted-foreground">{block.description}</p>
          )}
        </CardHeader>
      )}

      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {block.columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-medium text-muted-foreground ${alignClass(col.align)}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={`border-b border-gray-100 dark:border-gray-800 ${
                  rowIdx % 2 === 1
                    ? 'bg-gray-50/50 dark:bg-gray-800/30'
                    : ''
                }`}
              >
                {block.columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 text-foreground ${alignClass(col.align)}`}
                  >
                    {formatCell(row[col.key], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>

      {block.rowCount != null && (
        <CardFooter>
          <span className="text-xs text-muted-foreground">
            Showing {block.rows.length} of {block.rowCount} rows
          </span>
        </CardFooter>
      )}
    </Card>
  );
}
