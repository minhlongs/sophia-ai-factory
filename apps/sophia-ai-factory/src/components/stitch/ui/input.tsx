import React, { forwardRef } from 'react';
import { cn } from '@/seed/utils/cn';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  /** Left icon/prefix */
  prefix?: React.ReactNode;
  /** Right icon/suffix */
  suffix?: React.ReactNode;
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
}

/**
 * Stitch-compatible Input component
 *
 * Material Design 3 filled text field style with Sophia theme.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', prefix, suffix, error, errorMessage, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative group">
          {prefix && (
            <div className="absolute inset-y-0 left-0 pl-md flex items-center pointer-events-none">
              <span className="text-outline group-focus-within:text-primary transition-colors">
                {prefix}
              </span>
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'block w-full py-md px-md',
              prefix && 'pl-[44px]',
              suffix && 'pr-[44px]',
              'bg-surface border border-outline-variant rounded-xl',
              'font-body-md text-body-md text-on-surface',
              'placeholder:text-outline/60',
              'focus:border-primary focus:ring-4 focus:ring-primary/10',
              'focus:outline-none transition-all duration-200',
              error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              className
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute inset-y-0 right-0 pr-md flex items-center">
              {suffix}
            </div>
          )}
        </div>
        {error && errorMessage && (
          <p className="mt-sm text-destructive text-body-sm">{errorMessage}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', error, errorMessage, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            'block w-full py-md px-md',
            'bg-surface border border-outline-variant rounded-xl',
            'font-body-md text-body-md text-on-surface',
            'placeholder:text-outline/60',
            'focus:border-primary focus:ring-4 focus:ring-primary/10',
            'focus:outline-none transition-all duration-200 resize-none',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && errorMessage && (
          <p className="mt-sm text-destructive text-body-sm">{errorMessage}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
