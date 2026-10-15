import React, { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  withDot?: boolean;
}

export function Badge({
  className,
  variant = 'neutral',
  withDot = false,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    neutral: 'bg-secondary text-secondary-foreground border-border/50',
    info: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    error: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const dotColors = {
    neutral: 'bg-muted-foreground',
    info: 'bg-indigo-400 animate-pulse',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    error: 'bg-rose-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {withDot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}
