import type { Metadata } from 'next';
import CustomerClientLayout from './CustomerClientLayout';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Customer Portal - SALFANET RADIUS',
  manifest: '/manifest-customer.json',
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CustomerClientLayout>{children}</CustomerClientLayout>;
}

