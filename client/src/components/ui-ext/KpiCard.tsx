import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  helpText?: string;
  icon?: ReactNode;
  className?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function KpiCard({ label, value, helpText, icon, className, trend }: KpiCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-foreground">{value}</p>
              {trend && (
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
              )}
            </div>
            {helpText && (
              <p className="text-xs text-muted-foreground mt-1">{helpText}</p>
            )}
          </div>
          {icon && (
            <div className="text-muted-foreground">{icon}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

