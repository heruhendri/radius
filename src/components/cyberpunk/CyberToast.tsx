'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

// Toast Types
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

// Toast Context
interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a CyberToastProvider');
  }
  return context;
}

// Toast Provider
export function CyberToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 5000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <CyberToastContainer />
    </ToastContext.Provider>
  );
}

// Toast Container
function CyberToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <CyberToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

// Single Toast Item
interface CyberToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function CyberToastItem({ toast, onClose }: CyberToastItemProps) {
  const config = {
    success: {
      icon: CheckCircle,
      color: 'text-green-400',
      border: 'border-green-500/50',
      bg: 'from-green-500/10 to-transparent',
      glow: 'shadow-[0_0_30px_rgba(0,255,0,0.2)]',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-400',
      border: 'border-red-500/50',
      bg: 'from-red-500/10 to-transparent',
      glow: 'shadow-[0_0_30px_rgba(255,0,0,0.2)]',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-orange-400',
      border: 'border-orange-500/50',
      bg: 'from-orange-500/10 to-transparent',
      glow: 'shadow-[0_0_30px_rgba(255,165,0,0.2)]',
    },
    info: {
      icon: Info,
      color: 'text-cyan-400',
      border: 'border-cyan-500/50',
      bg: 'from-cyan-500/10 to-transparent',
      glow: 'shadow-[0_0_30px_rgba(0,255,255,0.2)]',
    },
  };

  const { icon: Icon, color, border, bg, glow } = config[toast.type];

  return (
    <div
      className={cn(
        'pointer-events-auto relative overflow-hidden',
        'bg-background/95 backdrop-blur-xl rounded-xl',
        'border-2',
        border,
        glow,
        'animate-in slide-in-from-right-full fade-in duration-300'
      )}
    >
      {/* Gradient background */}
      <div className={cn('absolute inset-0 bg-gradient-to-r opacity-50', bg)} />
      
      {/* Content */}
      <div className="relative flex items-start gap-3 p-4">
        <div className={cn('flex-shrink-0 mt-0.5', color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{toast.title}</p>
          {toast.description && (
            <p className="text-xs text-muted-foreground mt-1">{toast.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className={cn(
            'flex-shrink-0 p-1 rounded-lg',
            'text-muted-foreground hover:text-foreground',
            'hover:bg-white/10 transition-colors'
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
        <div
          className={cn(
            'h-full bg-gradient-to-r',
            toast.type === 'success' && 'from-green-400 to-green-500',
            toast.type === 'error' && 'from-red-400 to-red-500',
            toast.type === 'warning' && 'from-orange-400 to-orange-500',
            toast.type === 'info' && 'from-cyan-400 to-cyan-500',
            'animate-shrink-width'
          )}
          style={{
            animationDuration: `${toast.duration || 5000}ms`,
          }}
        />
      </div>
    </div>
  );
}

// Standalone Alert Component
interface CyberAlertProps {
  type: ToastType;
  title: string;
  description?: string;
  onClose?: () => void;
  className?: string;
}

function CyberAlert({ type, title, description, onClose, className }: CyberAlertProps) {
  const config = {
    success: {
      icon: CheckCircle,
      color: 'text-green-400',
      border: 'border-green-500/30',
      bg: 'bg-green-500/5',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-400',
      border: 'border-red-500/30',
      bg: 'bg-red-500/5',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-orange-400',
      border: 'border-orange-500/30',
      bg: 'bg-orange-500/5',
    },
    info: {
      icon: Info,
      color: 'text-cyan-400',
      border: 'border-cyan-500/30',
      bg: 'bg-cyan-500/5',
    },
  };

  const { icon: Icon, color, border, bg } = config[type];

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-4',
        border,
        bg,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5', color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-bold', color)}>{title}</p>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export { CyberAlert };
