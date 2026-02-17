'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, CreditCard, Calendar, Package, LogOut, Shield, Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { CyberCard, CyberButton } from '@/components/cyberpunk';

interface CustomerData {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  address?: string | null;
  status: string;
  packageName: string | null;
  packagePrice: number | null;
  expiryDate: string | null;
  createdAt?: string;
  profile?: {
    id: string;
    name: string;
    downloadSpeed: string;
    uploadSpeed: string;
  };
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('customer_token');
    
    if (!token) {
      router.push('/customer/login');
      return;
    }

    fetchCustomerProfile(token);
  }, [router]);

  const fetchCustomerProfile = async (token: string) => {
    try {
      const response = await fetch('/api/customer/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('customer_token');
          localStorage.removeItem('customer_user');
          router.push('/customer/login');
          return;
        }
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      if (data.success && data.user) {
        const user = data.user;
        setCustomer({
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          phone: user.phone,
          status: user.status,
          packageName: user.profile?.name || null,
          packagePrice: null, // Price not in response
          expiryDate: user.expiredAt,
          profile: user.profile
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    router.push('/customer/login');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-success/20 text-success border border-success/40 shadow-[0_0_5px_rgba(0,255,136,0.3)]';
      case 'SUSPENDED':
        return 'bg-destructive/20 text-destructive border border-destructive/40 shadow-[0_0_5px_rgba(255,51,102,0.3)]';
      case 'EXPIRED':
        return 'bg-warning/20 text-warning border border-warning/40 shadow-[0_0_5px_rgba(255,170,0,0.3)]';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  if (loading) {
    return (
      <div className="p-3 flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary shadow-[0_0_15px_rgba(188,19,254,0.5)]"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-3">
        <CyberCard className="p-4 text-center bg-destructive/10 border-2 border-destructive/30">
          <p className="text-destructive text-sm font-bold">
            {t('profile.loadError')}
          </p>
        </CyberCard>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Profile Header */}
      <CyberCard className="p-6 bg-gradient-to-r from-primary/20 to-accent/20 backdrop-blur-xl border-2 border-primary/40 shadow-[0_0_30px_rgba(188,19,254,0.3)]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/30 border-2 border-primary flex items-center justify-center shadow-[0_0_20px_rgba(188,19,254,0.5)]">
            <User size={32} className="text-primary drop-shadow-[0_0_10px_rgba(188,19,254,0.8)]" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{customer.name}</h1>
            <p className="text-accent text-sm font-mono">@{customer.username}</p>
          </div>
          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${getStatusBadge(customer.status)}`}>
            {customer.status}
          </span>
        </div>
      </CyberCard>

      {/* Contact Information */}
      <CyberCard className="p-4 bg-card/80 backdrop-blur-xl border-2 border-accent/30 shadow-[0_0_30px_rgba(0,247,255,0.15)]">
        <h2 className="text-sm font-bold text-accent mb-3 flex items-center gap-2 uppercase tracking-wider drop-shadow-[0_0_5px_rgba(0,247,255,0.5)]">
          <Mail size={16} className="drop-shadow-[0_0_5px_rgba(0,247,255,0.8)]" />
          {t('profile.contactInfo')}
        </h2>
        <div className="space-y-3">
          {customer.email && (
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-accent mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-accent font-bold uppercase tracking-wide">{t('profile.email')}</p>
                <p className="text-sm text-white">{customer.email}</p>
              </div>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-start gap-3">
              <Phone size={16} className="text-accent mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-accent font-bold uppercase tracking-wide">{t('profile.phone')}</p>
                <p className="text-sm text-white">{customer.phone}</p>
              </div>
            </div>
          )}
          {customer.address && (
            <div className="flex items-start gap-3">
              <User size={16} className="text-accent mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-accent font-bold uppercase tracking-wide">{t('profile.address')}</p>
                <p className="text-sm text-white">{customer.address}</p>
              </div>
            </div>
          )}
        </div>
      </CyberCard>

      {/* Package Information */}
      {customer.profile && (
        <CyberCard className="p-4 bg-card/80 backdrop-blur-xl border-2 border-primary/30 shadow-[0_0_30px_rgba(188,19,254,0.15)]">
          <h2 className="text-sm font-bold text-primary mb-3 flex items-center gap-2 uppercase tracking-wider drop-shadow-[0_0_5px_rgba(188,19,254,0.5)]">
            <Package size={16} className="drop-shadow-[0_0_5px_rgba(188,19,254,0.8)]" />
            {t('profile.packageInfo')}
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Package size={16} className="text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-accent font-bold uppercase tracking-wide">{t('profile.package')}</p>
                <p className="text-sm font-medium text-white">{customer.profile.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CreditCard size={16} className="text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-accent font-bold uppercase tracking-wide">Kecepatan</p>
                <p className="text-sm font-medium text-white">
                  ↓ {customer.profile.downloadSpeed} Mbps / ↑ {customer.profile.uploadSpeed} Mbps
                </p>
              </div>
            </div>
            {customer.expiryDate && (
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-accent font-bold uppercase tracking-wide">{t('profile.expiryDate')}</p>
                  <p className="text-sm text-white">
                    {new Date(customer.expiryDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CyberCard>
      )}

      {/* Account Information */}
      <CyberCard className="p-4 bg-card/80 backdrop-blur-xl border-2 border-primary/30 shadow-[0_0_30px_rgba(188,19,254,0.15)]">
        <h2 className="text-sm font-bold text-primary mb-3 flex items-center gap-2 uppercase tracking-wider drop-shadow-[0_0_5px_rgba(188,19,254,0.5)]">
          <Shield size={16} className="drop-shadow-[0_0_5px_rgba(188,19,254,0.8)]" />
          {t('profile.accountInfo')}
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <User size={16} className="text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-accent font-bold uppercase tracking-wide">{t('profile.username')}</p>
              <p className="text-sm font-mono text-white">{customer.username}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield size={16} className="text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-accent font-bold uppercase tracking-wide">ID</p>
              <p className="text-sm font-mono text-white">{customer.id}</p>
            </div>
          </div>
        </div>
      </CyberCard>

      {/* Actions */}
      <div className="space-y-2">
        <CyberButton
          onClick={handleLogout}
          variant="destructive"
          className="w-full flex items-center justify-center gap-2 py-3"
        >
          <LogOut size={18} />
          <span className="font-medium">{t('profile.logout')}</span>
        </CyberButton>
      </div>

      {/* Version Info */}
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground/60 font-mono">
          SalfaNet Radius v1.0.0
        </p>
      </div>
    </div>
  );
}
