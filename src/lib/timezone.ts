/**
 * Timezone Utilities for SALFANET RADIUS
 * 
 * ============================================
 * TIMEZONE CONSISTENCY ARCHITECTURE
 * ============================================
 * 
 * For consistent timezone handling across the entire system:
 * 
 * 1. SYSTEM TIMEZONE: Asia/Jakarta (WIB, UTC+7)
 *    - Set via: timedatectl set-timezone Asia/Jakarta
 *    - Affects: All OS-level timestamps, FreeRADIUS logs
 * 
 * 2. MYSQL TIMEZONE: +07:00 (matching system)
 *    - Config: /etc/mysql/mysql.conf.d/timezone.cnf
 *    - Set via: SET GLOBAL time_zone = '+07:00';
 *    - CRITICAL: MySQL MUST use same timezone as system!
 *    - NOW() and all datetime columns will use this timezone
 * 
 * 3. NODE.JS/PM2 TIMEZONE: Asia/Jakarta
 *    - Set via: TZ="Asia/Jakarta" in .env and ecosystem.config.js
 *    - Affects: new Date(), console.log timestamps
 * 
 * 4. FREERADIUS: Uses system timezone
 *    - radacct.acctstarttime is in system local time (WIB)
 *    - No conversion needed when storing to database
 * 
 * 5. DATABASE QUERIES:
 *    - Use NOW() for local time comparisons (NOT UTC_TIMESTAMP()!)
 *    - Example: WHERE expiresAt < NOW() -- Correct for WIB storage
 * 
 * ============================================
 * CRITICAL: Timezone Bug Prevention
 * ============================================
 * 
 * If MySQL timezone != System timezone:
 * - Voucher expiration will be incorrect (7 hour offset for WIB)
 * - NOW() vs UTC_TIMESTAMP() will give different results
 * - Sessions may appear active when they're expired
 * 
 * To verify timezone consistency:
 * ```bash
 * # 1. Check system timezone
 * timedatectl show --property=Timezone --value  # Should show: Asia/Jakarta
 * 
 * # 2. Check MySQL timezone
 * mysql -e "SELECT @@global.time_zone, NOW(), UTC_TIMESTAMP()"
 * # NOW() and system 'date' command should match!
 * 
 * # 3. Check Node.js timezone
 * node -e "console.log(new Date().toLocaleString('id-ID', {timeZone: 'Asia/Jakarta'}))"
 * ```
 * 
 * @see docs/VOUCHER_EXPIRATION_TIMEZONE_FIX.md for detailed explanation
 */

import { 
  format, 
  formatDistanceToNow, 
  differenceInDays,
  addDays,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { id as localeId } from 'date-fns/locale';

// Constants - These are default values, actual timezone is loaded from database/company settings
export const WIB_TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Jakarta';
export const WIB_OFFSET = '+07:00';

// Dynamic timezone getter - will be updated from company settings
let currentTimezone = WIB_TIMEZONE;

/**
 * Set the current timezone (called from company settings)
 */
export function setCurrentTimezone(timezone: string) {
  currentTimezone = timezone;
}

/**
 * Get the current configured timezone
 */
export function getCurrentTimezone(): string {
  return currentTimezone;
}

/**
 * Convert UTC date from database to local timezone for display
 * @param utc - UTC date from database
 * @returns Date object in local timezone or null
 */
export function toWIB(utc: Date | string | null | undefined): Date | null {
  if (!utc) return null;
  try {
    const date = typeof utc === 'string' ? new Date(utc) : utc;
    return toZonedTime(date, currentTimezone);
  } catch (error) {
    console.error('toWIB error:', error);
    return null;
  }
}

/**
 * Convert local timezone date to UTC for database storage
 * @param wib - Date in local timezone
 * @returns UTC Date object
 */
export function toUTC(wib: Date | string): Date {
  const date = typeof wib === 'string' ? new Date(wib) : wib;
  return fromZonedTime(date, currentTimezone);
}

/**
 * Format UTC date as WIB string
 * @param utc - UTC date from database
 * @param formatStr - Format string (default: 'dd MMM yyyy HH:mm')
 * @returns Formatted date string in WIB
 */
export function formatWIB(
  utc: Date | string | null | undefined,
  formatStr: string = 'dd MMM yyyy HH:mm'
): string {
  const wib = toWIB(utc);
  if (!wib) return '-';
  
  try {
    return format(wib, formatStr, { locale: localeId });
  } catch (error) {
    console.error('formatWIB error:', error);
    return '-';
  }
}

/**
 * Format a date that is ALREADY in local timezone (e.g., from FreeRADIUS/MySQL with local timezone)
 * This does NOT apply timezone conversion, just formats the date as-is.
 * 
 * Use this for:
 * - radpostauth.authdate (FreeRADIUS uses system timezone, MySQL NOW() uses local time)
 * - radacct timestamps when MySQL is configured with local timezone
 * 
 * @param localDate - Date already in local timezone from database
 * @param formatStr - Format string (default: 'dd MMM yyyy HH:mm')
 * @returns Formatted date string
 */
export function formatLocalDate(
  localDate: Date | string | null | undefined,
  formatStr: string = 'dd MMM yyyy HH:mm'
): string {
  if (!localDate) return '-';
  
  try {
    // Parse as-is without timezone conversion
    const date = typeof localDate === 'string' ? new Date(localDate) : localDate;
    if (isNaN(date.getTime())) return '-';
    
    // Format directly - the date is already in correct timezone
    return format(date, formatStr, { locale: localeId });
  } catch (error) {
    console.error('formatLocalDate error:', error);
    return '-';
  }
}

/**
 * Relative time from now in WIB (e.g., "2 jam yang lalu")
 */
export function relativeWIB(utc: Date | string | null | undefined): string {
  const wib = toWIB(utc);
  if (!wib) return '-';
  
  try {
    return formatDistanceToNow(wib, { 
      addSuffix: true, 
      locale: localeId 
    });
  } catch (error) {
    console.error('relativeWIB error:', error);
    return '-';
  }
}

/**
 * Check if UTC date is expired (compared to current WIB time)
 */
export function isExpiredWIB(utc: Date | string | null | undefined): boolean {
  const wib = toWIB(utc);
  if (!wib) return false;
  // Compare with current time IN WIB timezone, not browser timezone
  const nowInWIB = nowWIB();
  return isBefore(wib, nowInWIB);
}

/**
 * Days until expiry (negative if expired)
 */
export function daysUntilExpiry(utc: Date | string | null | undefined): number | null {
  const wib = toWIB(utc);
  if (!wib) return null;
  return differenceInDays(wib, new Date());
}

/**
 * Get current time in local timezone
 */
export function nowWIB(): Date {
  return toZonedTime(new Date(), currentTimezone);
}

/**
 * Add days to UTC date (returns UTC)
 */
export function addDaysToUTC(utc: Date | string, days: number): Date {
  const date = typeof utc === 'string' ? new Date(utc) : utc;
  return addDays(date, days);
}

/**
 * Get start of day in WIB, return as UTC
 */
export function startOfDayWIBtoUTC(date: Date | string = new Date()): Date {
  const wib = toWIB(date);
  if (!wib) return new Date();
  const startWIB = startOfDay(wib);
  return toUTC(startWIB);
}

/**
 * Get end of day in WIB, return as UTC
 */
export function endOfDayWIBtoUTC(date: Date | string = new Date()): Date {
  const wib = toWIB(date);
  if (!wib) return new Date();
  const endWIB = endOfDay(wib);
  return toUTC(endWIB);
}

/**
 * Format for datetime-local input (WIB)
 */
export function toDatetimeLocalWIB(utc: Date | string | null | undefined): string {
  if (!utc) return '';
  return formatWIB(utc, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Parse datetime-local input (WIB) to UTC
 */
export function fromDatetimeLocalWIB(datetimeLocal: string): Date {
  return toUTC(new Date(datetimeLocal));
}

/**
 * Get timezone info
 */
export function getTimezoneInfo() {
  const tzName = getTimezoneName(currentTimezone);
  const tzAbbr = getTimezoneAbbreviation(currentTimezone);
  const tzOffset = getTimezoneOffset(currentTimezone);
  
  return {
    timezone: currentTimezone,
    offset: tzOffset,
    name: tzName,
    abbreviation: tzAbbr,
  };
}

/**
 * Get timezone display name
 */
function getTimezoneName(tz: string): string {
  const tzMap: Record<string, string> = {
    'Asia/Jakarta': 'Western Indonesia Time (WIB)',
    'Asia/Makassar': 'Central Indonesia Time (WITA)',
    'Asia/Jayapura': 'Eastern Indonesia Time (WIT)',
    'Asia/Singapore': 'Singapore Time (SGT)',
    'Asia/Kuala_Lumpur': 'Malaysia Time (MYT)',
    'Asia/Bangkok': 'Indochina Time (ICT)',
    'Asia/Manila': 'Philippine Time (PHT)',
    'Asia/Ho_Chi_Minh': 'Indochina Time (ICT)',
    'Asia/Dubai': 'Gulf Standard Time (GST)',
    'Asia/Riyadh': 'Arabia Standard Time (AST)',
    'Asia/Tokyo': 'Japan Standard Time (JST)',
    'Asia/Seoul': 'Korea Standard Time (KST)',
    'Asia/Hong_Kong': 'Hong Kong Time (HKT)',
    'Australia/Sydney': 'Australian Eastern Time (AET)',
    'Australia/Melbourne': 'Australian Eastern Time (AET)',
    'Pacific/Auckland': 'New Zealand Time (NZT)',
  };
  return tzMap[tz] || tz;
}

/**
 * Get timezone abbreviation
 */
function getTimezoneAbbreviation(tz: string): string {
  const abbrevMap: Record<string, string> = {
    'Asia/Jakarta': 'WIB',
    'Asia/Makassar': 'WITA',
    'Asia/Jayapura': 'WIT',
    'Asia/Singapore': 'SGT',
    'Asia/Kuala_Lumpur': 'MYT',
    'Asia/Bangkok': 'ICT',
    'Asia/Manila': 'PHT',
    'Asia/Ho_Chi_Minh': 'ICT',
    'Asia/Dubai': 'GST',
    'Asia/Riyadh': 'AST',
    'Asia/Tokyo': 'JST',
    'Asia/Seoul': 'KST',
    'Asia/Hong_Kong': 'HKT',
    'Australia/Sydney': 'AEDT',
    'Australia/Melbourne': 'AEDT',
    'Pacific/Auckland': 'NZDT',
  };
  return abbrevMap[tz] || tz;
}

/**
 * Get timezone UTC offset
 */
function getTimezoneOffset(tz: string): string {
  const offsetMap: Record<string, string> = {
    'Asia/Jakarta': '+07:00',
    'Asia/Makassar': '+08:00',
    'Asia/Jayapura': '+09:00',
    'Asia/Singapore': '+08:00',
    'Asia/Kuala_Lumpur': '+08:00',
    'Asia/Bangkok': '+07:00',
    'Asia/Manila': '+08:00',
    'Asia/Ho_Chi_Minh': '+07:00',
    'Asia/Dubai': '+04:00',
    'Asia/Riyadh': '+03:00',
    'Asia/Tokyo': '+09:00',
    'Asia/Seoul': '+09:00',
    'Asia/Hong_Kong': '+08:00',
    'Australia/Sydney': '+11:00',
    'Australia/Melbourne': '+11:00',
    'Pacific/Auckland': '+13:00',
  };
  return offsetMap[tz] || '+07:00';
}

/**
 * Format date with status color indicator
 * Useful for due dates, expiry dates, etc.
 */
export function formatDateWithStatus(date: Date | string | null) {
  if (!date) return { text: '-', color: 'gray' as const };
  
  const days = daysUntilExpiry(date);
  if (days === null) return { text: '-', color: 'gray' as const };
  
  const formatted = formatWIB(date, 'dd MMM yyyy');
  
  if (days < 0) {
    return {
      text: `${formatted} (Telat ${Math.abs(days)} hari)`,
      color: 'red' as const,
    };
  } else if (days === 0) {
    return {
      text: `${formatted} (Hari ini!)`,
      color: 'orange' as const,
    };
  } else if (days <= 3) {
    return {
      text: `${formatted} (${days} hari lagi)`,
      color: 'yellow' as const,
    };
  } else {
    return {
      text: formatted,
      color: 'green' as const,
    };
  }
}
