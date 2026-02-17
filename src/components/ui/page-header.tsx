'use client';

import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="w-3 h-3" />}
              {crumb.href ? (
                <Link 
                  href={crumb.href} 
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {children}
    </div>
  );
}

interface PageCardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageCard({ children, className, noPadding }: PageCardProps) {
  return (
    <div className={cn(
      'bg-card rounded-lg border border-border',
      !noPadding && 'p-4',
      className
    )}>
      {children}
    </div>
  );
}

interface PageCardHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageCardHeader({ title, description, actions, className }: PageCardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 mb-4', className)}>
      <div>
        <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string | null;
  icon: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'destructive';
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  icon,
  variant = 'primary',
  className,
}: StatCardProps) {
  const variantStyles = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    info: 'text-info bg-info/10',
    destructive: 'text-destructive bg-destructive/10',
  };

  return (
    <div className={cn(
      'bg-card rounded-lg border border-border p-3 hover:shadow-md transition-shadow',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
            {title}
          </p>
          <p className="text-lg font-bold text-card-foreground mt-0.5">
            {value}
          </p>
          {change && (
            <p className={cn(
              'text-[10px] font-medium mt-0.5',
              change.startsWith('+') ? 'text-success' : 'text-destructive'
            )}>
              {change}
            </p>
          )}
        </div>
        <div className={cn('p-2 rounded-lg', variantStyles[variant])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="p-3 bg-muted rounded-full text-muted-foreground mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
