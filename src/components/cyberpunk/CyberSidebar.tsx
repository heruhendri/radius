'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';

interface SidebarItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: number | string;
  badgeColor?: 'cyan' | 'magenta' | 'green' | 'orange' | 'red';
  children?: { label: string; href: string; badge?: number | string }[];
}

interface SidebarUser {
  name: string;
  role?: string;
  avatar?: string;
}

interface CyberSidebarProps {
  items: SidebarItem[];
  logo?: React.ReactNode;
  title?: string;
  subtitle?: string;
  user?: SidebarUser;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  onLogout?: () => void;
  className?: string;
}

function CyberSidebar({
  items,
  logo,
  title = 'CYBERSYSTEM',
  subtitle = 'Dashboard',
  user,
  collapsed = false,
  onCollapse,
  onLogout,
  className,
}: CyberSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 z-50 h-screen',
        'bg-background/95 backdrop-blur-xl',
        'border-r-2 border-cyan-500/20',
        'shadow-[5px_0_30px_rgba(0,255,255,0.1)]',
        'transition-all duration-300 ease-out',
        collapsed ? 'w-20' : 'w-64',
        className
      )}
    >
      {/* Neon accent line */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-cyan-400 via-purple-400 to-pink-400 opacity-50" />

      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-cyan-500/20">
          <Link href="/" className="flex items-center gap-3">
            {logo || (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(0,255,255,0.4)]">
                <span className="text-black font-bold text-lg">{title.charAt(0)}</span>
              </div>
            )}
            {!collapsed && (
              <div>
                <h1 className="text-sm font-bold tracking-wide bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent truncate">
                  {title}
                </h1>
                <p className="text-[10px] text-muted-foreground tracking-widest capitalize">
                  {subtitle}
                </p>
              </div>
            )}
          </Link>
          
          {/* Collapse button */}
          {onCollapse && (
            <button
              onClick={() => onCollapse(!collapsed)}
              className={cn(
                'p-1.5 rounded-lg',
                'text-muted-foreground hover:text-cyan-400',
                'hover:bg-cyan-400/10 transition-colors',
                collapsed && 'absolute -right-3 top-7 bg-background border-2 border-cyan-500/30 shadow-lg'
              )}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 cyber-scrollbar">
          {items.map((item, index) => (
            <SidebarNavItem
              key={index}
              item={item}
              collapsed={collapsed}
              pathname={pathname}
            />
          ))}
        </nav>

        {/* User Section */}
        {user && (
          <div className="p-3 border-t border-cyan-500/20 bg-black/20">
            <div className="relative">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(0,255,255,0.3)]">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    <span className="text-white font-bold">{user.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                    <p className="text-[10px] text-cyan-400 truncate tracking-wider capitalize">
                      {user.role || 'User'}
                    </p>
                  </div>
                )}
                {!collapsed && onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// Navigation Item Component
function SidebarNavItem({
  item,
  collapsed,
  pathname,
}: {
  item: SidebarItem;
  collapsed: boolean;
  pathname: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isActive = item.href === pathname || item.children?.some((c) => c.href === pathname);

  // Auto-expand if child is active
  React.useEffect(() => {
    if (item.children?.some((c) => c.href === pathname)) {
      setIsOpen(true);
    }
  }, [pathname, item.children]);

  const badgeColors = {
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
    magenta: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
    green: 'bg-green-500/20 text-green-400 border-green-500/50',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    red: 'bg-red-500/20 text-red-400 border-red-500/50',
  };

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-300',
            isActive
              ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          )}
        >
          <span className={cn(
            'flex-shrink-0 transition-colors',
            isActive && 'drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]'
          )}>
            {item.icon}
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{item.label}</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
            </>
          )}
        </button>
        
        {!collapsed && isOpen && (
          <div className="mt-1 ml-3 pl-3 border-l-2 border-cyan-500/20 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {item.children.map((child, index) => (
              <Link
                key={index}
                href={child.href}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-200',
                  pathname === child.href
                    ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-500/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                <span>{child.label}</span>
                {child.badge !== undefined && (
                  <span className={cn(
                    'px-1.5 py-0.5 text-[9px] font-bold rounded border',
                    badgeColors[item.badgeColor || 'cyan']
                  )}>
                    {child.badge}
                  </span>
                )}
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
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-300',
        pathname === item.href
          ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      )}
    >
      <span className={cn(
        'flex-shrink-0 transition-colors',
        pathname === item.href && 'drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]'
      )}>
        {item.icon}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && (
            <span className={cn(
              'px-1.5 py-0.5 text-[9px] font-bold rounded border',
              badgeColors[item.badgeColor || 'cyan']
            )}>
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

export { CyberSidebar };
