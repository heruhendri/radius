/**
 * GenieACS Parameter Helpers
 * Utility functions for extracting, formatting, and displaying device parameters
 */

/**
 * Extract parameter value from device using fallback paths
 * Supports both flat field access (e.g., 'serialNumber') and nested paths (e.g., 'DeviceID.SerialNumber')
 * Handles GenieACS format: {_value: x, _type: y, _timestamp: z}
 */
export function extractParameterValue(device: any, parameterPaths: string[]): any {
  if (!device || !parameterPaths || parameterPaths.length === 0) {
    return null;
  }

  // First, try to get the value from the first path (usually the parameterName)
  // This is for values that were already extracted by the API
  const firstPath = parameterPaths[0];
  if (!firstPath.includes('.')) {
    const directValue = device[firstPath];
    // Accept the direct value if it exists (even if it's "-", because API already processed it)
    if (directValue !== undefined && directValue !== null && directValue !== '') {
      return directValue;
    }
  }

  // If first path didn't work, try all paths as fallback
  for (const path of parameterPaths) {
    try {
      let value;
      
      // Check if it's a simple field (no dots) - direct property access
      if (!path.includes('.')) {
        value = device[path];
      } else {
        // Handle nested paths like "InternetGatewayDevice.DeviceInfo.SerialNumber"
        value = path.split('.').reduce((obj, key) => {
          return obj?.[key];
        }, device);
      }

      // GenieACS stores values as {_value: x, _type: y, _timestamp: z}
      // Extract the actual value if it's in GenieACS format
      if (value && typeof value === 'object' && '_value' in value) {
        value = value._value;
      }

      // Check if value is valid (not null, undefined, empty string, or dash)
      if (value !== undefined && value !== null && value !== '' && value !== '-') {
        return value;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

/**
 * Format parameter value based on format type
 */
export function formatParameterValue(value: any, format?: string): string {
  if (value === null || value === undefined || value === '' || value === '-') {
    return '-';
  }

  switch (format) {
    case 'dBm':
      return `${value} dBm`;

    case 'celsius':
      return `${value}°C`;

    case 'voltage':
      return `${value} V`;

    case 'bytes':
      return formatBytes(value);

    case 'datetime':
      try {
        const date = new Date(value);
        return date.toLocaleString('id-ID', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        });
      } catch {
        return String(value);
      }

    case 'uptime':
      return formatUptime(value);

    case 'status':
      return String(value);

    case 'boolean':
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
      }
      if (value === 'true' || value === '1' || value === 1) {
        return 'Yes';
      }
      if (value === 'false' || value === '0' || value === 0) {
        return 'No';
      }
      return String(value);

    case 'text':
    default:
      return String(value);
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format uptime seconds to readable string
 */
function formatUptime(seconds: number | string): string {
  const sec = typeof seconds === 'string' ? parseInt(seconds) : seconds;
  
  if (isNaN(sec)) return String(seconds);

  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

/**
 * Get color class based on color coding rules
 */
export function getColorClass(value: any, colorCoding?: any): string {
  if (!colorCoding || !value) {
    return 'text-gray-800 dark:text-gray-200';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Check each color rule
  for (const [color, rule] of Object.entries(colorCoding)) {
    if (!rule || typeof rule !== 'object') continue;

    const { operator, value: ruleValue } = rule as any;

    let matches = false;

    switch (operator) {
      case '>':
        matches = numValue > ruleValue;
        break;
      case '<':
        matches = numValue < ruleValue;
        break;
      case '>=':
        matches = numValue >= ruleValue;
        break;
      case '<=':
        matches = numValue <= ruleValue;
        break;
      case '===':
      case 'equals':
        matches = value === ruleValue;
        break;
      case 'between':
        if (Array.isArray(ruleValue) && ruleValue.length === 2) {
          matches = numValue >= ruleValue[0] && numValue <= ruleValue[1];
        }
        break;
      case 'default':
        matches = true;
        break;
    }

    if (matches) {
      return getColorClassByName(color);
    }
  }

  return 'text-gray-800 dark:text-gray-200';
}

/**
 * Map color name to Tailwind classes
 */
function getColorClassByName(color: string): string {
  const colorMap: Record<string, string> = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    blue: 'text-blue-600 dark:text-blue-400',
    orange: 'text-orange-600 dark:text-orange-400',
    purple: 'text-purple-600 dark:text-purple-400',
    cyan: 'text-cyan-600 dark:text-cyan-400',
    gray: 'text-gray-600 dark:text-gray-400',
  };

  return colorMap[color] || 'text-gray-800 dark:text-gray-200';
}

/**
 * Get background color class for status badges
 */
export function getStatusBgClass(value: any, colorCoding?: any): string {
  if (!colorCoding || !value) {
    return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  for (const [color, rule] of Object.entries(colorCoding)) {
    if (!rule || typeof rule !== 'object') continue;

    const { operator, value: ruleValue } = rule as any;
    let matches = false;

    switch (operator) {
      case '>':
        matches = numValue > ruleValue;
        break;
      case '<':
        matches = numValue < ruleValue;
        break;
      case '>=':
        matches = numValue >= ruleValue;
        break;
      case '<=':
        matches = numValue <= ruleValue;
        break;
      case '===':
      case 'equals':
        matches = value === ruleValue;
        break;
      case 'between':
        if (Array.isArray(ruleValue) && ruleValue.length === 2) {
          matches = numValue >= ruleValue[0] && numValue <= ruleValue[1];
        }
        break;
      case 'default':
        matches = true;
        break;
    }

    if (matches) {
      return getStatusBgClassByName(color);
    }
  }

  return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
}

/**
 * Map color name to badge background classes
 */
function getStatusBgClassByName(color: string): string {
  const colorMap: Record<string, string> = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };

  return colorMap[color] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
}

/**
 * Get icon color class based on value and color coding
 */
export function getIconColorClass(value: any, colorCoding?: any): string {
  if (!colorCoding || !value) {
    return 'text-gray-400';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  for (const [color, rule] of Object.entries(colorCoding)) {
    if (!rule || typeof rule !== 'object') continue;

    const { operator, value: ruleValue } = rule as any;
    let matches = false;

    switch (operator) {
      case '>':
        matches = numValue > ruleValue;
        break;
      case '<':
        matches = numValue < ruleValue;
        break;
      case '>=':
        matches = numValue >= ruleValue;
        break;
      case '<=':
        matches = numValue <= ruleValue;
        break;
      case '===':
      case 'equals':
        matches = value === ruleValue;
        break;
      case 'between':
        if (Array.isArray(ruleValue) && ruleValue.length === 2) {
          matches = numValue >= ruleValue[0] && numValue <= ruleValue[1];
        }
        break;
    }

    if (matches) {
      return `text-${color}-600`;
    }
  }

  return 'text-gray-400';
}

/**
 * Group configs by section
 */
export function groupConfigsBySection(configs: any[]): Record<string, any[]> {
  return configs.reduce((acc, config) => {
    if (!acc[config.section]) {
      acc[config.section] = [];
    }
    acc[config.section].push(config);
    return acc;
  }, {} as Record<string, any[]>);
}

/**
 * Get section display name
 */
export function getSectionDisplayName(section: string): string {
  const nameMap: Record<string, string> = {
    main: 'Main',
    device_info: 'Device Information',
    connection_info: 'Connection Info',
    optical_info: 'Optical Signal Info',
    lan_config: 'LAN Configuration',
    wifi_config: 'WiFi Configuration',
    system_info: 'System Information',
  };

  return nameMap[section] || section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get section icon and color
 */
export function getSectionStyle(section: string): { gradient: string; border: string; icon: string } {
  const styleMap: Record<string, { gradient: string; border: string; icon: string }> = {
    device_info: {
      gradient: 'from-blue-500 to-blue-600',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20'
    },
    connection_info: {
      gradient: 'from-green-500 to-green-600',
      border: 'border-green-200 dark:border-green-800',
      icon: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20'
    },
    optical_info: {
      gradient: 'from-purple-500 to-purple-600',
      border: 'border-purple-200 dark:border-purple-800',
      icon: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20'
    },
    lan_config: {
      gradient: 'from-cyan-500 to-cyan-600',
      border: 'border-cyan-200 dark:border-cyan-800',
      icon: 'bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20'
    },
  };

  return styleMap[section] || {
    gradient: 'from-gray-500 to-gray-600',
    border: 'border-gray-200 dark:border-gray-800',
    icon: 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20'
  };
}
