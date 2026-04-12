'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle, Clock, CheckCircle2, Calendar, FileText, 
  Shield, AlertTriangle
} from 'lucide-react';
import { formatDateOnly } from '@/lib/date-only';
import { cn } from '@/lib/utils';
import type { ActionItem } from '@/types';

export type { ActionItem };

interface ActionQueueProps {
  items: ActionItem[];
  title?: string;
}

const priorityConfig = {
  critical: { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  high: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle },
  medium: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  low: { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: CheckCircle2 },
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  leave_request: Calendar,
  expiring_document: FileText,
  milestone: Clock,
  compliance: Shield,
  default: AlertCircle,
};

const typeRoutes: Record<string, string> = {
  leave_request: '/leave',
  expiring_document: '/compliance',
  milestone: '/compliance',
  compliance: '/compliance',
};

export function ActionQueue({ items, title = 'Action Queue' }: ActionQueueProps) {
  const router = useRouter();
  if (items.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
            <p className="text-sm font-medium text-slate-700">All caught up!</p>
            <p className="text-xs text-slate-500 mt-1">No pending actions requiring attention</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">{title}</CardTitle>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
            {items.length} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-slate-200">
            {items.map((item) => {
              const PriorityIcon = priorityConfig[item.priority].icon;
              const TypeIcon = typeIcons[item.type] || typeIcons.default;
              
              return (
                <div 
                  key={item.id} 
                  className="flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    priorityConfig[item.priority].color
                  )}>
                    <PriorityIcon className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.description}
                        </p>
                        {item.dueDate && (
                          <p className="text-xs text-slate-400 mt-1">
                            Due: {formatDateOnly(item.dueDate)}
                          </p>
                        )}
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn('text-xs capitalize flex-shrink-0', priorityConfig[item.priority].color)}
                      >
                        {item.priority}
                      </Badge>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0 h-8 text-xs"
                    onClick={() => router.push(typeRoutes[item.type] || '/approvals')}
                  >
                    Review
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
