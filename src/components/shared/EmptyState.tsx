import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="w-12 h-12 rounded-xl bg-[var(--muted-surface)] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[var(--text-disabled)]" aria-hidden="true" />
      </div>
      <h3 className="ds-title">{title}</h3>
      <p className="ds-meta mt-1 max-w-xs">{description}</p>
      {action && (
        <Button
          size="sm"
          className="mt-4 h-8 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
          onClick={action.onClick}
          {...(action.href ? { asChild: true } : {})}
        >
          {action.href ? (
            <a href={action.href}>{action.label}</a>
          ) : (
            action.label
          )}
        </Button>
      )}
    </div>
  );
}
