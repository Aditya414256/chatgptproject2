import { cn } from '../../lib/utils';

type SkeletonVariant = 'text' | 'circle' | 'rect';

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  /** Width (applies to all variants). Accepts Tailwind class or CSS value. */
  width?: string;
  /** Height (applies to text and rect). Accepts Tailwind class or CSS value. */
  height?: string;
  /** Number of text lines to render (only for text variant) */
  lines?: number;
}

const variantBase: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded',
  circle: 'rounded-full',
  rect: 'w-full rounded-lg',
};

export function Skeleton({
  variant = 'rect',
  className,
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'animate-pulse bg-neutral-200',
              variantBase.text,
              i === lines - 1 && 'w-3/4', // last line is shorter
            )}
            style={{
              ...(width ? { width } : {}),
              ...(height ? { height } : {}),
            }}
          />
        ))}
      </div>
    );
  }

  const sizeStyle: React.CSSProperties = {};
  if (width) sizeStyle.width = width;
  if (height) sizeStyle.height = height;

  if (variant === 'circle' && !width && !height) {
    sizeStyle.width = '2.5rem';
    sizeStyle.height = '2.5rem';
  }
  if (variant === 'rect' && !height) {
    sizeStyle.height = '6rem';
  }

  return (
    <div
      className={cn('animate-pulse bg-neutral-200', variantBase[variant], className)}
      style={sizeStyle}
      aria-hidden="true"
    />
  );
}
