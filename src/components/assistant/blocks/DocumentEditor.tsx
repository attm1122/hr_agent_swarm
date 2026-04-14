'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UIAction } from '@/lib/ai-os';
import type { DocumentEditorBlock } from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

export default function DocumentEditor({
  block,
}: BlockComponentProps<DocumentEditorBlock>) {
  const [content, setContent] = useState(block.markdown);
  const isEditable = block.readOnly === false;

  return (
    <Card className="rounded-xl border bg-white shadow-sm dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Read-only markdown viewer */}
        <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm leading-relaxed text-foreground dark:border-gray-700 dark:bg-gray-800">
          {isEditable ? content : block.markdown}
        </pre>

        {/* Editable textarea when readOnly === false */}
        {isEditable && (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[160px] w-full rounded-lg border border-input bg-transparent p-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            placeholder="Edit document content..."
          />
        )}
      </CardContent>
    </Card>
  );
}
