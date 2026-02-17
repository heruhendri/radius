/**
 * Hook untuk manage timezone di client-side
 * Sinkronisasi dengan Company Settings dari database via Zustand store
 */

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { id as localeId } from 'date-fns/locale';
import { useAppStore } from '@/lib/store';
import { setCurrentTimezone as setLibTimezone } from '@/lib/timezone';

// All supported timezones
const SUPPORTED_TIMEZONES = {
  // Indonesia
  'Asia/Jakarta': { name: 'WIB (Jakarta)', offset: '+07:00', region: 'Indonesia' },
  'Asia/Makassar': { name: 'WITA (Makassar)', offset: '+08:00', region: 'Indonesia' },
  'Asia/Jayapura': { name: 'WIT (Jayapura)', offset: '+09:00', region: 'Indonesia' },
  // Southeast Asia
  'Asia/Singapore': { name: 'Singapore (SGT)', offset: '+08:00', region: 'Southeast Asia' },
  'Asia/Kuala_Lumpur': { name: 'Malaysia (MYT)', offset: '+08:00', region: 'Southeast Asia' },
  'Asia/Bangkok': { name: 'Thailand (ICT)', offset: '+07:00', region: 'Southeast Asia' },
  'Asia/Manila': { name: 'Philippines (PHT)', offset: '+08:00', region: 'Southeast Asia' },
  'Asia/Ho_Chi_Minh': { name: 'Vietnam (ICT)', offset: '+07:00', region: 'Southeast Asia' },
  // Other Asia
  'Asia/Dubai': { name: 'UAE (GST)', offset: '+04:00', region: 'Asia' },
  'Asia/Riyadh': { name: 'Saudi Arabia (AST)', offset: '+03:00', region: 'Asia' },
  'Asia/Tokyo': { name: 'Japan (JST)', offset: '+09:00', region: 'Asia' },
  'Asia/Seoul': { name: 'South Korea (KST)', offset: '+09:00', region: 'Asia' },
  'Asia/Hong_Kong': { name: 'Hong Kong (HKT)', offset: '+08:00', region: 'Asia' },
  // Australia & Pacific
  'Australia/Sydney': { name: 'Sydney (AEDT)', offset: '+11:00', region: 'Australia' },
  'Australia/Melbourne': { name: 'Melbourne (AEDT)', offset: '+11:00', region: 'Australia' },
  'Pacific/Auckland': { name: 'New Zealand (NZDT)', offset: '+13:00', region: 'Pacific' },
} as const;

type SupportedTimezone = keyof typeof SUPPORTED_TIMEZONES;

// Default timezone
const DEFAULT_TIMEZONE = 'Asia/Jakarta';

export interface TimezoneInfo {
  timezone: string;
  name: string;
  offset: string;
  region: string;
}

export function useTimezone() {
  const { company, setCompany, initializeTimezone } = useAppStore();
  const timezone = company.timezone || DEFAULT_TIMEZONE;
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize timezone from server on mount
  useEffect(() => {
    const init = async () => {
      await initializeTimezone();
      setIsLoaded(true);
    };
    init();
  }, [initializeTimezone]);

  // Update timezone (syncs with lib and store)
  const setTimezone = useCallback((tz: string) => {
    if (Object.keys(SUPPORTED_TIMEZONES).includes(tz)) {
      setLibTimezone(tz);
      setCompany({ timezone: tz });
    }
  }, [setCompany]);

  // Format date to configured timezone
  const formatDate = useCallback((
    date: Date | string | null | undefined,
    formatStr: string = 'dd MMM yyyy HH:mm'
  ): string => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? parseISO(date) : date;
      return formatInTimeZone(d, timezone, formatStr, { locale: localeId });
    } catch {
      return '-';
    }
  }, [timezone]);

  // Format date only
  const formatDateOnly = useCallback((date: Date | string | null | undefined): string => {
    return formatDate(date, 'dd/MM/yyyy');
  }, [formatDate]);

  // Format time only
  const formatTimeOnly = useCallback((date: Date | string | null | undefined): string => {
    return formatDate(date, 'HH:mm:ss');
  }, [formatDate]);

  // Format date and time
  const formatDateTime = useCallback((date: Date | string | null | undefined): string => {
    return formatDate(date, 'dd/MM/yyyy HH:mm:ss');
  }, [formatDate]);

  // Get timezone info
  const getTimezoneInfo = useCallback((): TimezoneInfo => {
    const tzInfo = SUPPORTED_TIMEZONES[timezone as SupportedTimezone] || SUPPORTED_TIMEZONES[DEFAULT_TIMEZONE];
    return {
      timezone,
      name: tzInfo.name,
      offset: tzInfo.offset,
      region: tzInfo.region,
    };
  }, [timezone]);

  // Get current time in configured timezone
  const now = useCallback((): Date => {
    return toZonedTime(new Date(), timezone);
  }, [timezone]);

  // Available timezones grouped by region
  const availableTimezones = Object.entries(SUPPORTED_TIMEZONES).map(([key, value]) => ({
    value: key,
    label: value.name,
    offset: value.offset,
    region: value.region,
  }));

  return {
    timezone,
    setTimezone,
    formatDate,
    formatDateOnly,
    formatTimeOnly,
    formatDateTime,
    getTimezoneInfo,
    now,
    availableTimezones,
    isLoaded,
  };
}

// Non-hook version for server-side or initial load
export function getDefaultTimezone(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_TIMEZONE || DEFAULT_TIMEZONE;
  }
  return localStorage.getItem('company_timezone') || DEFAULT_TIMEZONE;
}
