import Link from 'next/link';
import { notFound } from 'next/navigation';
import { composeEmployeeDetail } from '@/lib/ai-os/ui-composer/rules/records.rules';
import BlockRenderer from '@/components/assistant/BlockRenderer';
import ErrorBoundary from '@/components/assistant/ErrorBoundary';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeProfilePage({ params }: PageProps) {
  const { id } = await params;
  const blocks = composeEmployeeDetail(id);
  if (blocks.length === 0) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <Link href="/employees" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Directory
      </Link>
      <ErrorBoundary>
        <div className="flex flex-col gap-4">
          {blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} />
          ))}
        </div>
      </ErrorBoundary>
    </div>
  );
}
