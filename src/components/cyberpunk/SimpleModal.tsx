'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SimpleModal - A lightweight cyberpunk-themed modal component
 * Compatible with existing isOpen/onClose patterns used throughout admin pages
 */

interface SimpleModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    showClose?: boolean;
    className?: string;
}

interface ModalHeaderProps {
    children: React.ReactNode;
    onClose?: () => void;
    className?: string;
}

interface ModalBodyProps {
    children: React.ReactNode;
    className?: string;
}

interface ModalFooterProps {
    children: React.ReactNode;
    className?: string;
}

const sizeClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-[95vw] h-[90vh]',
};

export function SimpleModal({
    isOpen,
    onClose,
    children,
    size = 'md',
    showClose = true,
    className
}: SimpleModalProps) {
    // Handle escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Backdrop with blur and subtle grid */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md">
                {/* Scan line effect */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,255,0.02)_2px,rgba(0,255,255,0.02)_4px)] pointer-events-none" />
            </div>

            {/* Modal Container */}
            <div
                className={cn(
                    'relative w-full',
                    sizeClasses[size],
                    // Base styles
                    'bg-[#1a0f35] rounded-xl overflow-hidden',
                    // Border with glow
                    'border-2 border-[#bc13fe]/40',
                    // Shadow glow effect
                    'shadow-[0_0_50px_rgba(188,19,254,0.25),0_0_100px_rgba(0,247,255,0.1)]',
                    // Animation
                    'animate-in fade-in-0 zoom-in-95 duration-200',
                    className
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top neon line accent */}
                <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-[#00f7ff] to-transparent" />

                {/* Close button */}
                {showClose && (
                    <button
                        onClick={onClose}
                        className={cn(
                            'absolute right-3 top-3 z-10 rounded-lg p-2',
                            'text-[#e0d0ff]/60 hover:text-[#00f7ff]',
                            'bg-[#0a0520]/50 hover:bg-[#bc13fe]/20',
                            'border border-[#bc13fe]/30 hover:border-[#00f7ff]/50',
                            'transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-[#00f7ff]/50'
                        )}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}

                {children}
            </div>
        </div>
    );
}

export function ModalHeader({ children, onClose, className }: ModalHeaderProps) {
    return (
        <div className={cn(
            'px-5 py-4 border-b border-[#bc13fe]/30',
            'bg-gradient-to-r from-[#bc13fe]/10 via-transparent to-[#00f7ff]/10',
            className
        )}>
            {children}
        </div>
    );
}

export function ModalTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <h2 className={cn(
            'text-base font-bold text-white',
            'drop-shadow-[0_0_10px_rgba(0,247,255,0.3)]',
            className
        )}>
            {children}
        </h2>
    );
}

export function ModalDescription({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <p className={cn('text-xs text-[#e0d0ff]/70 mt-1', className)}>
            {children}
        </p>
    );
}

export function ModalBody({ children, className }: ModalBodyProps) {
    return (
        <div className={cn(
            'px-5 py-4 max-h-[60vh] overflow-y-auto',
            // Custom scrollbar for cyberpunk theme
            'scrollbar-thin scrollbar-thumb-[#bc13fe]/40 scrollbar-track-transparent',
            className
        )}>
            {children}
        </div>
    );
}

export function ModalFooter({ children, className }: ModalFooterProps) {
    return (
        <div className={cn(
            'px-5 py-4 border-t border-[#bc13fe]/30',
            'bg-gradient-to-r from-[#bc13fe]/5 via-transparent to-[#00f7ff]/5',
            'flex items-center justify-end gap-3',
            className
        )}>
            {children}
        </div>
    );
}

// Cyberpunk styled form input for modals
export function ModalInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cn(
                'w-full px-3 py-2 text-sm',
                'bg-[#0a0520] border-2 border-[#bc13fe]/30 rounded-lg',
                'text-white placeholder-[#e0d0ff]/40',
                'focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff]/50',
                'focus:shadow-[0_0_15px_rgba(0,247,255,0.2)]',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#0a0520]/50',
                'transition-all outline-none',
                className
            )}
            {...props}
        />
    );
}

export function ModalSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            className={cn(
                'w-full px-3 py-2 text-sm',
                'bg-[#0a0520] border-2 border-[#bc13fe]/30 rounded-lg',
                'text-white',
                'focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff]/50',
                'transition-all outline-none appearance-none cursor-pointer',
                className
            )}
            {...props}
        >
            {children}
        </select>
    );
}

export function ModalTextarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            className={cn(
                'w-full px-3 py-2 text-sm',
                'bg-[#0a0520] border-2 border-[#bc13fe]/30 rounded-lg',
                'text-white placeholder-[#e0d0ff]/40',
                'focus:border-[#00f7ff] focus:ring-1 focus:ring-[#00f7ff]/50',
                'focus:shadow-[0_0_15px_rgba(0,247,255,0.2)]',
                'transition-all outline-none resize-none',
                className
            )}
            {...props}
        />
    );
}

export function ModalLabel({ children, className, required }: { children: React.ReactNode; className?: string; required?: boolean }) {
    return (
        <label className={cn('block text-xs font-medium text-[#e0d0ff] mb-1.5', className)}>
            {children}
            {required && <span className="text-[#ff44cc] ml-0.5">*</span>}
        </label>
    );
}

// Button variants for modal
export function ModalButton({
    variant = 'primary',
    className,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' }) {
    const variants = {
        primary: cn(
            'bg-gradient-to-r from-[#bc13fe] to-[#00f7ff]',
            'hover:from-[#a010e0] hover:to-[#00d4dd]',
            'text-white font-bold',
            'shadow-[0_0_20px_rgba(188,19,254,0.3)]',
            'hover:shadow-[0_0_30px_rgba(188,19,254,0.5)]'
        ),
        secondary: cn(
            'bg-[#0a0520] border-2 border-[#bc13fe]/30',
            'hover:border-[#00f7ff]/50 hover:bg-[#bc13fe]/10',
            'text-[#e0d0ff]'
        ),
        danger: cn(
            'bg-gradient-to-r from-[#ff4466] to-[#ff44cc]',
            'hover:from-[#e03d5d] hover:to-[#e03db3]',
            'text-white font-bold',
            'shadow-[0_0_20px_rgba(255,68,102,0.3)]'
        ),
        success: cn(
            'bg-gradient-to-r from-[#00ff88] to-[#00f7ff]',
            'hover:from-[#00dd77] hover:to-[#00d4dd]',
            'text-black font-bold',
            'shadow-[0_0_20px_rgba(0,255,136,0.3)]'
        ),
    };

    return (
        <button
            className={cn(
                'px-4 py-2 text-sm rounded-lg',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
