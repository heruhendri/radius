'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// Animated Neon Border Effect
export function NeonBorder({
  children,
  color = 'cyan',
  className,
  animated = true,
}: {
  children: React.ReactNode;
  color?: 'cyan' | 'magenta' | 'purple' | 'blue' | 'green' | 'orange';
  className?: string;
  animated?: boolean;
}) {
  const colorMap = {
    cyan: 'from-cyan-400 via-cyan-500 to-cyan-400',
    magenta: 'from-pink-400 via-pink-500 to-pink-400',
    purple: 'from-purple-400 via-purple-500 to-purple-400',
    blue: 'from-blue-400 via-blue-500 to-blue-400',
    green: 'from-green-400 via-green-500 to-green-400',
    orange: 'from-orange-400 via-orange-500 to-orange-400',
  };

  return (
    <div className={cn('relative group', className)}>
      {/* Neon glow background */}
      <div
        className={cn(
          'absolute -inset-0.5 bg-gradient-to-r rounded-lg opacity-75 blur-sm transition-all duration-300',
          colorMap[color],
          animated && 'group-hover:opacity-100 group-hover:blur-md animate-pulse-slow'
        )}
      />
      {/* Content */}
      <div className="relative bg-background rounded-lg">{children}</div>
    </div>
  );
}

// Glowing Text Effect
export function NeonText({
  children,
  color = 'cyan',
  size = 'md',
  className,
  animate = false,
}: {
  children: React.ReactNode;
  color?: 'cyan' | 'magenta' | 'purple' | 'blue' | 'mixed';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animate?: boolean;
}) {
  const colorMap = {
    cyan: 'text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]',
    magenta: 'text-pink-400 drop-shadow-[0_0_10px_rgba(255,0,255,0.8)]',
    purple: 'text-purple-400 drop-shadow-[0_0_10px_rgba(147,51,234,0.8)]',
    blue: 'text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]',
    mixed: 'bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent',
  };

  const sizeMap = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-2xl',
  };

  return (
    <span
      className={cn(
        'font-bold tracking-wide',
        colorMap[color],
        sizeMap[size],
        animate && 'animate-neon-flicker',
        className
      )}
    >
      {children}
    </span>
  );
}

// Scan Line Effect Overlay
export function ScanLines({
  intensity = 'light',
  className,
}: {
  intensity?: 'light' | 'medium' | 'heavy';
  className?: string;
}) {
  const intensityMap = {
    light: 'opacity-[0.02]',
    medium: 'opacity-[0.04]',
    heavy: 'opacity-[0.08]',
  };

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-10',
        intensityMap[intensity],
        className
      )}
      style={{
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 255, 255, 0.1) 2px,
          rgba(0, 255, 255, 0.1) 4px
        )`,
      }}
    />
  );
}

// Glitch Effect Component
export function GlitchText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn('relative inline-block', className)}>
      <span className="relative z-10">{children}</span>
      <span
        className="absolute top-0 left-0 -z-10 text-cyan-400 animate-glitch-1"
        aria-hidden="true"
      >
        {children}
      </span>
      <span
        className="absolute top-0 left-0 -z-10 text-pink-400 animate-glitch-2"
        aria-hidden="true"
      >
        {children}
      </span>
    </div>
  );
}

// Cyber Grid Background
export function CyberGrid({
  className,
  animate = true,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {/* Grid pattern */}
      <div
        className={cn(
          'absolute inset-0 opacity-[0.03]',
          animate && 'animate-grid-scroll'
        )}
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background" />
    </div>
  );
}

// Floating Particles Effect
export function CyberParticles({
  count = 20,
  className,
}: {
  count?: number;
  className?: string;
}) {
  const particles = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 5,
    }));
  }, [count]);

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-cyan-400/30 animate-float"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
            boxShadow: `0 0 ${particle.size * 2}px rgba(0, 255, 255, 0.5)`,
          }}
        />
      ))}
    </div>
  );
}

// Hexagon Pattern Background
export function HexagonPattern({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none opacity-5', className)}>
      <svg width="100%" height="100%">
        <defs>
          <pattern id="hexagons" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(0.5)">
            <polygon
              points="28,2 54,18 54,50 28,66 2,50 2,18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-cyan-400"
            />
            <polygon
              points="28,68 54,84 54,116 28,132 2,116 2,84"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-cyan-400"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexagons)" />
      </svg>
    </div>
  );
}
