import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface SkeletonCardProps {
  showHeader?: boolean;
  lines?: number;
  className?: string;
}

export function SkeletonCard({ showHeader = true, lines = 3, className }: SkeletonCardProps) {
  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

