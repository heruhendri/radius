'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const CyberModal = DialogPrimitive.Root;
const CyberModalTrigger = DialogPrimitive.Trigger;
const CyberModalClose = DialogPrimitive.Close;
const CyberModalPortal = DialogPrimitive.Portal;

// Overlay
const CyberModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50',
      'bg-black/80 backdrop-blur-md',
      // Scan line effect
      'before:absolute before:inset-0 before:pointer-events-none',
      'before:bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,255,0.03)_2px,rgba(0,255,255,0.03)_4px)]',
      // Animation
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
CyberModalOverlay.displayName = 'CyberModalOverlay';

// Content
interface CyberModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  variant?: 'default' | 'neon' | 'glass';
  size?: 'sm' | 'default' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
}

const CyberModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  CyberModalContentProps
>(({ className, children, variant = 'default', size = 'default', showClose = true, ...props }, ref) => {
  const sizeStyles = {
    sm: 'max-w-sm',
    default: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw] h-[90vh]',
  };

  const variantStyles = {
    default: cn(
      'bg-background border-2 border-cyan-500/30',
      'shadow-[0_0_50px_rgba(0,255,255,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]'
    ),
    neon: cn(
      'bg-black/90 border-2 border-cyan-400',
      'shadow-[0_0_60px_rgba(0,255,255,0.3),0_0_100px_rgba(0,255,255,0.1),inset_0_0_30px_rgba(0,255,255,0.05)]'
    ),
    glass: cn(
      'bg-white/5 backdrop-blur-xl border border-white/20',
      'shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
    ),
  };

  return (
    <CyberModalPortal>
      <CyberModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
          'w-full p-0 rounded-xl overflow-hidden',
          sizeStyles[size],
          variantStyles[variant],
          // Animation
          'duration-300',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          className
        )}
        {...props}
      >
        {/* Top neon line */}
        {variant === 'neon' && (
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        )}
        
        {children}
        
        {showClose && (
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4 rounded-lg p-2',
              'text-muted-foreground hover:text-cyan-400',
              'bg-white/5 hover:bg-white/10',
              'border border-white/10 hover:border-cyan-400/30',
              'transition-all duration-300',
              'focus:outline-none focus:ring-2 focus:ring-cyan-400/50'
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </CyberModalPortal>
  );
});
CyberModalContent.displayName = 'CyberModalContent';

// Header
const CyberModalHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-6 py-5 border-b border-cyan-500/20',
      'bg-gradient-to-r from-cyan-500/5 via-transparent to-pink-500/5',
      className
    )}
    {...props}
  />
));
CyberModalHeader.displayName = 'CyberModalHeader';

// Title
const CyberModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-bold tracking-wide text-foreground',
      'drop-shadow-[0_0_10px_rgba(0,255,255,0.3)]',
      className
    )}
    {...props}
  />
));
CyberModalTitle.displayName = 'CyberModalTitle';

// Description
const CyberModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground mt-1', className)}
    {...props}
  />
));
CyberModalDescription.displayName = 'CyberModalDescription';

// Body
const CyberModalBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-6 py-5 max-h-[60vh] overflow-y-auto', className)}
    {...props}
  />
));
CyberModalBody.displayName = 'CyberModalBody';

// Footer
const CyberModalFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-6 py-4 border-t border-cyan-500/20',
      'bg-gradient-to-r from-cyan-500/5 via-transparent to-pink-500/5',
      'flex items-center justify-end gap-3',
      className
    )}
    {...props}
  />
));
CyberModalFooter.displayName = 'CyberModalFooter';

export {
  CyberModal,
  CyberModalTrigger,
  CyberModalClose,
  CyberModalPortal,
  CyberModalOverlay,
  CyberModalContent,
  CyberModalHeader,
  CyberModalTitle,
  CyberModalDescription,
  CyberModalBody,
  CyberModalFooter,
};
