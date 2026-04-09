import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'emerald' | 'navy' | 'amber' | 'red';
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  trend = 'neutral', 
  description,
  icon: Icon,
  variant = 'default'
}: MetricCardProps) {
  const variantStyles = {
    default: 'bg-white',
    emerald: 'bg-emerald-50/50 border-emerald-200',
    navy: 'bg-slate-900 text-white border-slate-800',
    amber: 'bg-amber-50/50 border-amber-200',
    red: 'bg-red-50/50 border-red-200',
  };
  
  const isDark = variant === 'navy';
  
  return (
    <Card className={cn('border shadow-sm', variantStyles[variant])}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={cn('text-sm font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {title}
            </p>
            <p className={cn('text-2xl font-bold tracking-tight', isDark ? 'text-white' : 'text-slate-900')}>
              {value}
            </p>
          </div>
          {Icon && (
            <div className={cn(
              'p-2 rounded-lg',
              isDark ? 'bg-slate-800' : 'bg-slate-100'
            )}>
              <Icon className={cn('w-4 h-4', isDark ? 'text-slate-400' : 'text-slate-600')} />
            </div>
          )}
        </div>
        
        {(change !== undefined || description) && (
          <div className="flex items-center gap-2 mt-3">
            {change !== undefined && (
              <div className={cn(
                'flex items-center gap-1 text-xs font-medium',
                trend === 'up' ? 'text-emerald-600' : 
                trend === 'down' ? 'text-red-600' : 
                isDark ? 'text-slate-400' : 'text-slate-500'
              )}>
                {trend === 'up' && <TrendingUp className="w-3 h-3" />}
                {trend === 'down' && <TrendingDown className="w-3 h-3" />}
                {trend === 'neutral' && <Minus className="w-3 h-3" />}
                {change > 0 ? '+' : ''}{change}%
              </div>
            )}
            {description && (
              <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                {description}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
