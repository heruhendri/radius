'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { formatWIB } from '@/lib/timezone';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

interface AgentNotificationDropdownProps {
  agentId: string;
}

export default function AgentNotificationDropdown({ agentId }: AgentNotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (agentId) {
      loadNotifications();
      // Refresh every 15 seconds for agent (more frequent)
      const interval = setInterval(loadNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [agentId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const loadNotifications = async () => {
    if (!agentId) return;
    
    try {
      const res = await fetch(`/api/agent/notifications?limit=10&agentId=${agentId}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Load notifications error:', error);
    }
  };

  const markAsRead = async (notificationIds: string[]) => {
    try {
      await fetch('/api/agent/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds, agentId }),
      });
      loadNotifications();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/agent/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true, agentId }),
      });
      loadNotifications();
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/agent/notifications?id=${id}`, {
        method: 'DELETE',
      });
      loadNotifications();
    } catch (error) {
      console.error('Delete notification error:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = 'w-5 h-5';
    switch (type) {
      case 'voucher_generated':
        return <Bell className={`${iconClass} text-[#00f7ff] drop-shadow-[0_0_8px_rgba(0,247,255,0.6)]`} />;
      case 'deposit_success':
        return <Check className={`${iconClass} text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.6)]`} />;
      case 'low_balance':
        return <Bell className={`${iconClass} text-[#ff6b8a] drop-shadow-[0_0_8px_rgba(255,107,138,0.6)]`} />;
      case 'voucher_sold':
        return <CheckCheck className={`${iconClass} text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.6)]`} />;
      default:
        return <Bell className={`${iconClass} text-[#bc13fe] drop-shadow-[0_0_8px_rgba(188,19,254,0.6)]`} />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'voucher_generated':
        return 'bg-[#00f7ff]/30 border-[#00f7ff]/70';
      case 'deposit_success':
        return 'bg-[#00ff88]/30 border-[#00ff88]/70';
      case 'low_balance':
        return 'bg-[#ff4466]/30 border-[#ff4466]/70';
      case 'voucher_sold':
        return 'bg-[#00ff88]/30 border-[#00ff88]/70';
      default:
        return 'bg-[#bc13fe]/30 border-[#bc13fe]/70';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-[#bc13fe]/10 transition"
      >
        <Bell className="h-5 w-5 text-[#e0d0ff]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-[#ff4466] to-[#ff44cc] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-[0_0_10px_rgba(255,68,102,0.5)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-[#0a0520] border-2 border-[#00f7ff]/50 rounded-2xl shadow-[0_0_50px_rgba(0,247,255,0.4)] z-[9999] overflow-hidden backdrop-blur-xl">
          <div className="px-4 py-3 bg-gradient-to-r from-[#bc13fe]/20 to-[#00f7ff]/20 border-b border-[#00f7ff]/30 flex items-center justify-between">
            <h3 className="text-base font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">Notifikasi</h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-[#00ff88] hover:text-[#00f7ff] transition font-bold"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="h-12 w-12 text-[#00f7ff]/40 mx-auto mb-3 drop-shadow-[0_0_20px_rgba(0,247,255,0.3)]" />
                <p className="text-sm font-medium text-white">Belum ada notifikasi</p>
                <p className="text-xs text-[#e0d0ff]/60 mt-1">Notifikasi akan muncul di sini</p>
              </div>
            ) : (
              <div className="divide-y divide-[#bc13fe]/20">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-[#bc13fe]/10 transition ${
                      !notification.isRead ? 'bg-gradient-to-r from-[#bc13fe]/15 to-[#00f7ff]/15 border-l-4 border-[#00f7ff]' : 'bg-[#0a0520]'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`p-2.5 rounded-xl border-2 ${getNotificationBg(notification.type)} shadow-[0_0_15px_rgba(0,247,255,0.2)]`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="text-sm font-bold text-white truncate drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
                            {notification.title}
                          </h4>
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1.5 hover:bg-[#ff4466]/30 rounded-lg transition flex-shrink-0 border border-[#ff4466]/30"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[#ff6b8a]" />
                          </button>
                        </div>
                        <p className="text-xs text-white/90 mb-2 line-clamp-2 leading-relaxed">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#00f7ff]/80 font-medium">
                            {formatWIB(new Date(notification.createdAt), 'dd MMM HH:mm')}
                          </span>
                          {!notification.isRead && (
                            <button
                              onClick={() => markAsRead([notification.id])}
                              className="text-xs text-[#00ff88] hover:text-[#00f7ff] transition font-bold px-2 py-1 rounded-lg bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/30"
                            >
                              Tandai dibaca
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
