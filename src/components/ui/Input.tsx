import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className, wrapperClassName, id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const inputId = externalId ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint && !error ? `${inputId}-hint` : undefined;

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
            {label}
          </label>
        )}

        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId ?? hintId}
            className={cn(
              'h-10 w-full rounded-lg border bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors',
              'focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20',
              'disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400',
              error
                ? 'border-accent text-accent focus:border-accent focus:ring-accent/20'
                : 'border-neutral-300',
              icon ? 'pl-10' : '',
              className,
            )}
            {...props}
          />
        </div>

        {error && (
          <p id={errorId} role="alert" className="text-xs text-accent">
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={hintId} className="text-xs text-neutral-500">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
