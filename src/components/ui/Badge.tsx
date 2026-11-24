import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import type { OrderStatus } from '../../types/database';

type BadgeVariant =
  | OrderStatus
  | 'info'
  | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  /** Optional dot indicator before the label */
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  accepted: 'bg-blue-100 text-blue-800 border-blue-200',
  ready: 'bg-primary-100 text-primary-800 border-primary-200',
  out_for_delivery: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  expired: 'bg-orange-100 text-orange-800 border-orange-200',
  not_collected: 'bg-amber-100 text-amber-800 border-amber-200',
  info: 'bg-sky-100 text-sky-800 border-sky-200',
  default: 'bg-neutral-100 text-neutral-700 border-neutral-200',
};

const dotColors: Record<BadgeVariant, string> = {
  pending: 'bg-yellow-500',
  accepted: 'bg-blue-500',
  ready: 'bg-primary-600',
  out_for_delivery: 'bg-indigo-500',
  completed: 'bg-green-500',
  rejected: 'bg-red-500',
  cancelled: 'bg-neutral-400',
  expired: 'bg-orange-500',
  not_collected: 'bg-amber-500',
  info: 'bg-sky-500',
  default: 'bg-neutral-400',
};

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
  not_collected: 'Not Collected',
};

export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-tight',
        variantStyles[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotColors[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/** Convenience component that maps an OrderStatus to the right badge variant and label. */
export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <Badge variant={status} dot className={className}>
      {statusLabels[status]}
    </Badge>
  );
}
