'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Menu, X, Search, Bell, Sun, Moon, ChevronDown } from 'lucide-react';

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: number;
  children?: { label: string; href: string; icon?: React.ReactNode }[];
}

interface CyberNavbarProps {
  logo?: React.ReactNode;
  title?: string;
  subtitle?: string;
  items?: NavItem[];
  showSearch?: boolean;
  showThemeToggle?: boolean;
  showNotifications?: boolean;
  notificationCount?: number;
  darkMode?: boolean;
  onThemeToggle?: () => void;
  rightContent?: React.ReactNode;
  className?: string;
}

function CyberNavbar({
  logo,
  title = 'CYBERSYSTEM',
  subtitle,
  items = [],
  showSearch = true,
  showThemeToggle = true,
  showNotifications = true,
  notificationCount = 0,
  darkMode = true,
  onThemeToggle,
  rightContent,
  className,
}: CyberNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [searchFocused, setSearchFocused] = React.useState(false);

  return (
    <header
      className={cn(
        'sticky top-0 z-50',
        'bg-background/80 backdrop-blur-xl',
        'border-b-2 border-cyan-500/20',
        'shadow-[0_4px_30px_rgba(0,255,255,0.1)]',
        className
      )}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-foreground transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            {logo || (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(0,255,255,0.4)]">
                <span className="text-black font-bold text-lg">{title.charAt(0)}</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold tracking-wide bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {subtitle}
                </p>
              )}
            </div>
          </Link>
        </div>

        {/* Center - Navigation (desktop) */}
        <nav className="hidden lg:flex items-center gap-1">
          {items.map((item, index) => (
            <NavItemComponent key={index} item={item} />
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Search */}
          {showSearch && (
            <div className="hidden sm:block relative">
              <Search
                className={cn(
                  'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors',
                  searchFocused ? 'text-cyan-400' : 'text-muted-foreground'
                )}
              />
              <input
                type="text"
                placeholder="Search..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className={cn(
                  'w-48 lg:w-64 h-9 pl-10 pr-4 rounded-lg text-sm',
                  'bg-white/5 border border-white/10',
                  'placeholder:text-muted-foreground/50',
                  'focus:outline-none focus:border-cyan-400/50 focus:bg-white/10',
                  'focus:shadow-[0_0_20px_rgba(0,255,255,0.1)]',
                  'transition-all duration-300'
                )}
              />
            </div>
          )}

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-white/10 mx-2" />

          {/* Theme toggle */}
          {showThemeToggle && (
            <button
              onClick={onThemeToggle}
              className={cn(
                'p-2 rounded-lg transition-all duration-300',
                'hover:bg-white/5 border border-transparent hover:border-white/10'
              )}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-orange-400 drop-shadow-[0_0_10px_rgba(255,165,0,0.5)]" />
              ) : (
                <Moon className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          )}

          {/* Notifications */}
          {showNotifications && (
            <button
              className={cn(
                'relative p-2 rounded-lg transition-all duration-300',
                'hover:bg-white/5 border border-transparent hover:border-white/10'
              )}
            >
              <Bell className="w-5 h-5 text-muted-foreground hover:text-cyan-400 transition-colors" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-pink-500 text-white rounded-full shadow-[0_0_10px_rgba(255,0,255,0.5)]">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
          )}

          {/* Custom right content */}
          {rightContent}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-cyan-500/20 bg-background/95 backdrop-blur-xl">
          <nav className="p-4 space-y-2">
            {items.map((item, index) => (
              <MobileNavItem key={index} item={item} onClose={() => setMobileMenuOpen(false)} />
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

// Desktop Nav Item
function NavItemComponent({ item }: { item: NavItem }) {
  const [isOpen, setIsOpen] = React.useState(false);

  if (item.children) {
    return (
      <div className="relative" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
        <button
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300',
            'text-muted-foreground hover:text-cyan-400',
            'hover:bg-cyan-400/10',
            isOpen && 'text-cyan-400 bg-cyan-400/10'
          )}
        >
          {item.icon}
          {item.label}
          <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 py-2 min-w-[200px] bg-background/95 backdrop-blur-xl border-2 border-cyan-500/30 rounded-xl shadow-[0_0_30px_rgba(0,255,255,0.15)] animate-in fade-in slide-in-from-top-2 duration-200">
            {item.children.map((child, index) => (
              <Link
                key={index}
                href={child.href}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
              >
                {child.icon}
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href || '#'}
      className={cn(
        'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300',
        'text-muted-foreground hover:text-cyan-400',
        'hover:bg-cyan-400/10'
      )}
    >
      {item.icon}
      {item.label}
      {item.badge !== undefined && item.badge > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-pink-500 text-white rounded-full">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// Mobile Nav Item
function MobileNavItem({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const [isOpen, setIsOpen] = React.useState(false);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
        >
          <span className="flex items-center gap-3">
            {item.icon}
            {item.label}
          </span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
        {isOpen && (
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-cyan-500/20 pl-4">
            {item.children.map((child, index) => (
              <Link
                key={index}
                href={child.href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
              >
                {child.icon}
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href || '#'}
      onClick={onClose}
      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
    >
      {item.icon}
      {item.label}
      {item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-pink-500 text-white rounded-full">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export { CyberNavbar };
