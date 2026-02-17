/**
 * Input Validation & Sanitization Utilities
 * 
 * Provides comprehensive validation and sanitization functions to prevent:
 * - SQL Injection (though Prisma handles this)
 * - XSS (Cross-Site Scripting)
 * - Command Injection
 * - Path Traversal
 * - NoSQL Injection
 * - LDAP Injection
 * 
 * @module validation
 */

// ==============================================
// VALIDATION FUNCTIONS
// ==============================================

/**
 * Validate email format
 * Uses RFC 5322 compliant regex (simplified version)
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate Indonesian phone number
 * Formats: 08xx, +628xx, 628xx, 8xx
 * Returns cleaned number with 62 prefix if valid
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Must be 10-13 digits
  if (cleaned.length < 10 || cleaned.length > 13) return false;
  
  // Must start with 0, 62, or 8
  if (!cleaned.match(/^(0|62|8)/)) return false;
  
  return true;
}

/**
 * Validate and sanitize phone number to 62xxx format
 */
export function sanitizePhone(phone: string): string | null {
  if (!isValidPhone(phone)) return null;
  
  let cleaned = phone.replace(/\D/g, '');
  
  // Convert to 62 prefix
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  
  return cleaned;
}

/**
 * Validate username (alphanumeric + underscore/dash)
 * 3-32 characters, no spaces
 */
export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== 'string') return false;
  
  const usernameRegex = /^[a-zA-Z0-9_-]{3,32}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password strength
 * - Minimum 8 characters
 * - At least 1 uppercase (optional, can be enabled)
 * - At least 1 lowercase
 * - At least 1 number (optional, can be enabled)
 * 
 * @param options - Validation options
 */
export function isValidPassword(
  password: string,
  options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumber?: boolean;
    requireSpecialChar?: boolean;
  } = {}
): { valid: boolean; errors: string[] } {
  const {
    minLength = 8,
    requireUppercase = false,
    requireLowercase = true,
    requireNumber = false,
    requireSpecialChar = false,
  } = options;

  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate IPv4 address
 */
export function isValidIPv4(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Validate MAC address
 */
export function isValidMacAddress(mac: string): boolean {
  if (!mac || typeof mac !== 'string') return false;
  
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
}

/**
 * Validate integer within range
 */
export function isValidInteger(
  value: any,
  min?: number,
  max?: number
): boolean {
  const num = parseInt(value, 10);
  
  if (isNaN(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  
  return true;
}

/**
 * Validate float within range
 */
export function isValidFloat(
  value: any,
  min?: number,
  max?: number
): boolean {
  const num = parseFloat(value);
  
  if (isNaN(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  
  return true;
}

/**
 * Validate date string (ISO 8601 or common formats)
 */
export function isValidDate(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

// ==============================================
// SANITIZATION FUNCTIONS
// ==============================================

/**
 * Sanitize string to prevent XSS
 * Escapes HTML special characters
 */
export function sanitizeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  
  const htmlEscapeMap: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return str.replace(/[&<>"'/]/g, char => htmlEscapeMap[char]);
}

/**
 * Sanitize string for SQL LIKE queries
 * Escapes wildcards to prevent injection
 */
export function sanitizeLikeQuery(str: string): string {
  if (!str || typeof str !== 'string') return '';
  
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Sanitize filename to prevent path traversal
 * Removes directory traversal characters and restricted characters
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return '';
  
  // Remove path traversal attempts
  let safe = filename.replace(/\.\./g, '');
  
  // Remove path separators
  safe = safe.replace(/[/\\]/g, '');
  
  // Remove null bytes
  safe = safe.replace(/\0/g, '');
  
  // Remove control characters
  safe = safe.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  // Remove restricted characters (Windows + Unix)
  safe = safe.replace(/[<>:"|?*]/g, '');
  
  // Trim dots and spaces from start/end
  safe = safe.replace(/^[\s.]+|[\s.]+$/g, '');
  
  // Limit length
  if (safe.length > 255) {
    const ext = safe.split('.').pop() || '';
    const name = safe.slice(0, 255 - ext.length - 1);
    safe = ext ? `${name}.${ext}` : name;
  }
  
  return safe || 'unnamed';
}

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizePath(path: string): string {
  if (!path || typeof path !== 'string') return '';
  
  // Remove null bytes
  let safe = path.replace(/\0/g, '');
  
  // Remove path traversal attempts
  safe = safe.replace(/\.\./g, '');
  
  // Normalize path separators to forward slash
  safe = safe.replace(/\\/g, '/');
  
  // Remove duplicate slashes
  safe = safe.replace(/\/+/g, '/');
  
  // Remove leading/trailing slashes
  safe = safe.replace(/^\/+|\/+$/g, '');
  
  return safe;
}

/**
 * Sanitize JSON string to prevent injection
 * Validates and re-stringifies to ensure proper formatting
 */
export function sanitizeJson(jsonString: string): string | null {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

/**
 * Strip all HTML tags from string
 * Use with caution - better to sanitize specific tags
 */
export function stripHtmlTags(str: string): string {
  if (!str || typeof str !== 'string') return '';
  
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize string for use in shell commands
 * WARNING: Best practice is to avoid shell execution entirely
 */
export function sanitizeShellArg(arg: string): string {
  if (!arg || typeof arg !== 'string') return '';
  
  // Remove dangerous characters
  return arg.replace(/[;&|`$(){}[\]<>\\'"]/g, '');
}

// ==============================================
// VALIDATION HELPERS
// ==============================================

/**
 * Validate object against schema
 * Simple schema validator for API requests
 */
export function validateSchema<T extends Record<string, any>>(
  data: any,
  schema: {
    [K in keyof T]: {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      required?: boolean;
      min?: number;
      max?: number;
      pattern?: RegExp;
      validator?: (value: any) => boolean;
    };
  }
): { valid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];
    const fieldErrors: string[] = [];

    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
      fieldErrors.push(`${key} is required`);
      errors[key] = fieldErrors;
      continue;
    }

    // Skip validation if not required and not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // Check type
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rules.type) {
      fieldErrors.push(`${key} must be a ${rules.type}`);
    }

    // Check min/max for strings and numbers
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.min !== undefined && value.length < rules.min) {
        fieldErrors.push(`${key} must be at least ${rules.min} characters`);
      }
      if (rules.max !== undefined && value.length > rules.max) {
        fieldErrors.push(`${key} must be at most ${rules.max} characters`);
      }
    }

    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        fieldErrors.push(`${key} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        fieldErrors.push(`${key} must be at most ${rules.max}`);
      }
    }

    // Check pattern
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      fieldErrors.push(`${key} format is invalid`);
    }

    // Check custom validator
    if (rules.validator && !rules.validator(value)) {
      fieldErrors.push(`${key} validation failed`);
    }

    if (fieldErrors.length > 0) {
      errors[key] = fieldErrors;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate enum value
 */
export function isValidEnum<T extends string>(
  value: string,
  enumValues: readonly T[]
): value is T {
  return enumValues.includes(value as T);
}

/**
 * Sanitize object by removing undefined/null values
 */
export function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      cleaned[key as keyof T] = value;
    }
  }
  
  return cleaned;
}

/**
 * Deep clone object (simple version)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ==============================================
// COMMON VALIDATION PATTERNS
// ==============================================

export const ValidationPatterns = {
  // Indonesian phone: 08xx-xxxx-xxxx
  PHONE_ID: /^(08|628|\+628|8)[0-9]{8,11}$/,
  
  // Email (RFC 5322 simplified)
  EMAIL: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  
  // Username: alphanumeric + underscore/dash
  USERNAME: /^[a-zA-Z0-9_-]{3,32}$/,
  
  // IPv4 address
  IPV4: /^(\d{1,3}\.){3}\d{1,3}$/,
  
  // MAC address
  MAC: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
  
  // URL
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  
  // Alphanumeric only
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  
  // Numeric only
  NUMERIC: /^[0-9]+$/,
  
  // Alphabetic only
  ALPHA: /^[a-zA-Z]+$/,
} as const;

// ==============================================
// ERROR MESSAGES
// ==============================================

export const ValidationMessages = {
  REQUIRED: (field: string) => `${field} is required`,
  INVALID_EMAIL: 'Invalid email format',
  INVALID_PHONE: 'Invalid phone number format',
  INVALID_USERNAME: 'Username must be 3-32 characters, alphanumeric with underscore/dash only',
  INVALID_PASSWORD: 'Password does not meet requirements',
  INVALID_URL: 'Invalid URL format',
  INVALID_IP: 'Invalid IP address format',
  INVALID_MAC: 'Invalid MAC address format',
  INVALID_DATE: 'Invalid date format',
  MIN_LENGTH: (field: string, min: number) => `${field} must be at least ${min} characters`,
  MAX_LENGTH: (field: string, max: number) => `${field} must be at most ${max} characters`,
  MIN_VALUE: (field: string, min: number) => `${field} must be at least ${min}`,
  MAX_VALUE: (field: string, max: number) => `${field} must be at most ${max}`,
  INVALID_ENUM: (field: string, values: string[]) => `${field} must be one of: ${values.join(', ')}`,
} as const;
