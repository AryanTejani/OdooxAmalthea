import { Skeleton } from '@/components/ui/skeleton';
import { TableCell } from '@/components/ui/table';

interface SkeletonRowProps {
  columns: number;
  className?: string;
}

export function SkeletonRow({ columns, className }: SkeletonRowProps) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </tr>
  );
}

