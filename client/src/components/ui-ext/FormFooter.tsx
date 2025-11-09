import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface FormFooterProps {
  primaryAction: {
    label: string;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  className?: string;
}

export function FormFooter({ primaryAction, secondaryAction, className }: FormFooterProps) {
  return (
    <div className={cn('flex items-center justify-end gap-3 pt-4 border-t', className)}>
      {secondaryAction && (
        <Button
          type="button"
          variant="outline"
          onClick={secondaryAction.onClick}
          disabled={secondaryAction.disabled || primaryAction.loading}
        >
          {secondaryAction.label}
        </Button>
      )}
      <Button
        type="button"
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled || primaryAction.loading}
      >
        {primaryAction.loading ? 'Saving...' : primaryAction.label}
      </Button>
    </div>
  );
}

