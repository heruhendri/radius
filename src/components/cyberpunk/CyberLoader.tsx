'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// Main Loader Component
interface CyberLoaderProps {
  size?: 'sm' | 'default' | 'lg' | 'xl';
  variant?: 'spinner' | 'pulse' | 'dots' | 'bars' | 'hexagon';
  color?: 'cyan' | 'magenta' | 'purple' | 'mixed';
  className?: string;
}

function CyberLoader({
  size = 'default',
  variant = 'spinner',
  color = 'cyan',
  className,
}: CyberLoaderProps) {
  const sizeMap = {
    sm: 'w-4 h-4',
    default: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const colorMap = {
    cyan: 'text-cyan-400',
    magenta: 'text-pink-400',
    purple: 'text-purple-400',
    mixed: 'text-cyan-400',
  };

  if (variant === 'spinner') {
    return (
      <div className={cn('relative', sizeMap[size], className)}>
        <div className={cn(
          'absolute inset-0 rounded-full border-2 border-current opacity-20',
          colorMap[color]
        )} />
        <div className={cn(
          'absolute inset-0 rounded-full border-2 border-transparent animate-spin',
          'border-t-current',
          colorMap[color],
          'drop-shadow-[0_0_10px_currentColor]'
        )} />
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('relative', sizeMap[size], className)}>
        <div className={cn(
          'absolute inset-0 rounded-full animate-ping opacity-75',
          color === 'cyan' && 'bg-cyan-400',
          color === 'magenta' && 'bg-pink-400',
          color === 'purple' && 'bg-purple-400',
          color === 'mixed' && 'bg-gradient-to-r from-cyan-400 to-pink-400'
        )} />
        <div className={cn(
          'absolute inset-2 rounded-full',
          color === 'cyan' && 'bg-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.5)]',
          color === 'magenta' && 'bg-pink-400 shadow-[0_0_20px_rgba(255,0,255,0.5)]',
          color === 'purple' && 'bg-purple-400 shadow-[0_0_20px_rgba(147,51,234,0.5)]',
          color === 'mixed' && 'bg-gradient-to-r from-cyan-400 to-pink-400'
        )} />
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'rounded-full animate-bounce',
              size === 'sm' && 'w-1.5 h-1.5',
              size === 'default' && 'w-2 h-2',
              size === 'lg' && 'w-3 h-3',
              size === 'xl' && 'w-4 h-4',
              color === 'cyan' && 'bg-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.5)]',
              color === 'magenta' && 'bg-pink-400 shadow-[0_0_10px_rgba(255,0,255,0.5)]',
              color === 'purple' && 'bg-purple-400 shadow-[0_0_10px_rgba(147,51,234,0.5)]',
              color === 'mixed' && i === 0 && 'bg-cyan-400',
              color === 'mixed' && i === 1 && 'bg-purple-400',
              color === 'mixed' && i === 2 && 'bg-pink-400'
            )}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'bars') {
    return (
      <div className={cn('flex items-end gap-1', className)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'rounded-sm animate-pulse',
              size === 'sm' && 'w-1',
              size === 'default' && 'w-1.5',
              size === 'lg' && 'w-2',
              size === 'xl' && 'w-2.5',
              color === 'cyan' && 'bg-cyan-400',
              color === 'magenta' && 'bg-pink-400',
              color === 'purple' && 'bg-purple-400',
              color === 'mixed' && 'bg-gradient-to-t from-cyan-400 to-pink-400'
            )}
            style={{
              height: `${Math.random() * 50 + 50}%`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: '0.5s',
            }}
          />
        ))}
      </div>
    );
  }

  // Hexagon variant
  return (
    <div className={cn('relative', sizeMap[size], className)}>
      <svg viewBox="0 0 100 100" className="animate-spin-slow">
        <polygon
          points="50,5 90,25 90,75 50,95 10,75 10,25"
          fill="none"
          strokeWidth="3"
          className={cn(
            'stroke-current',
            colorMap[color],
            'drop-shadow-[0_0_10px_currentColor]'
          )}
          strokeDasharray="200"
          strokeDashoffset="100"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="200;0"
            dur="2s"
            repeatCount="indefinite"
          />
        </polygon>
      </svg>
    </div>
  );
}

// Full Page Loader
interface CyberPageLoaderProps {
  text?: string;
  variant?: 'spinner' | 'pulse' | 'hexagon';
}

function CyberPageLoader({ text = 'Loading...', variant = 'spinner' }: CyberPageLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <CyberLoader size="xl" variant={variant} color="mixed" />
        <p className="text-sm text-cyan-400 font-bold uppercase tracking-widest animate-pulse">
          {text}
        </p>
      </div>
    </div>
  );
}

// Skeleton Component
interface CyberSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
}

function CyberSkeleton({
  className,
  variant = 'default',
  ...props
}: CyberSkeletonProps) {
  const variantStyles = {
    default: 'rounded-lg',
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10',
        'bg-[length:200%_100%] animate-shimmer',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

// Card Skeleton
function CyberCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      'rounded-xl border-2 border-cyan-500/20 bg-background/50 p-5',
      className
    )}>
      <div className="flex items-start gap-4">
        <CyberSkeleton variant="circular" className="w-12 h-12" />
        <div className="flex-1 space-y-3">
          <CyberSkeleton className="h-4 w-3/4" />
          <CyberSkeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <CyberSkeleton className="h-3 w-full" />
        <CyberSkeleton className="h-3 w-5/6" />
        <CyberSkeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}

// Progress Bar
interface CyberProgressProps {
  value: number;
  max?: number;
  color?: 'cyan' | 'magenta' | 'purple' | 'green' | 'mixed';
  size?: 'sm' | 'default' | 'lg';
  showValue?: boolean;
  animated?: boolean;
  className?: string;
}

function CyberProgress({
  value,
  max = 100,
  color = 'cyan',
  size = 'default',
  showValue = false,
  animated = true,
  className,
}: CyberProgressProps) {
  const percentage = Math.min(100, (value / max) * 100);

  const sizeStyles = {
    sm: 'h-1',
    default: 'h-2',
    lg: 'h-3',
  };

  const colorStyles = {
    cyan: 'from-cyan-400 to-cyan-500 shadow-[0_0_20px_rgba(0,255,255,0.5)]',
    magenta: 'from-pink-400 to-pink-500 shadow-[0_0_20px_rgba(255,0,255,0.5)]',
    purple: 'from-purple-400 to-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.5)]',
    green: 'from-green-400 to-green-500 shadow-[0_0_20px_rgba(0,255,0,0.5)]',
    mixed: 'from-cyan-400 via-purple-400 to-pink-400 shadow-[0_0_20px_rgba(147,51,234,0.5)]',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn(
        'w-full rounded-full bg-white/5 overflow-hidden',
        sizeStyles[size]
      )}>
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r transition-all duration-500',
            colorStyles[color],
            animated && 'animate-pulse'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showValue && (
        <p className="mt-1 text-xs text-muted-foreground text-right">
          {Math.round(percentage)}%
        </p>
      )}
    </div>
  );
}

export {
  CyberLoader,
  CyberPageLoader,
  CyberSkeleton,
  CyberCardSkeleton,
  CyberProgress,
};
