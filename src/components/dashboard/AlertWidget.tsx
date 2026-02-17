import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface Alert {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp?: Date | string;
}

interface AlertWidgetProps {
  alerts: Alert[];
  maxAlerts?: number;
  title?: string;
}

const alertStyles = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: <CheckCircle className="w-5 h-5 text-green-600" />,
    text: 'text-green-800',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: <XCircle className="w-5 h-5 text-red-600" />,
    text: 'text-red-800',
  },
  warning: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: <AlertCircle className="w-5 h-5 text-orange-600" />,
    text: 'text-orange-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Info className="w-5 h-5 text-blue-600" />,
    text: 'text-blue-800',
  },
};

export default function AlertWidget({
  alerts,
  maxAlerts = 5,
  title = 'System Alerts',
}: AlertWidgetProps) {
  const displayAlerts = alerts.slice(0, maxAlerts);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 h-full flex flex-col">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      
      {displayAlerts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mb-2" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            All systems operational
          </p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-auto">
          {displayAlerts.map((alert) => {
            const style = alertStyles[alert.type];
            return (
              <div
                key={alert.id}
                className={`${style.bg} border ${style.border} rounded-md p-3`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">{style.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-semibold ${style.text} truncate`}>
                      {alert.title}
                    </h4>
                    <p className={`text-sm ${style.text} mt-1`}>
                      {alert.message}
                    </p>
                    {alert.timestamp && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {new Date(alert.timestamp).toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Pre-configured alert widgets
interface NetworkAlert {
  id: string;
  deviceName: string;
  status: 'online' | 'offline' | 'degraded';
  timestamp: Date | string;
}

interface NetworkStatusProps {
  alerts?: NetworkAlert[];
}

export function NetworkStatusWidget({ alerts = [] }: NetworkStatusProps) {
  const formattedAlerts: Alert[] = alerts.map(alert => ({
    id: alert.id,
    type: alert.status === 'online' ? 'success' : alert.status === 'offline' ? 'error' : 'warning',
    title: alert.deviceName,
    message: `Device is ${alert.status}`,
    timestamp: alert.timestamp,
  }));

  return <AlertWidget alerts={formattedAlerts} title="Network Status" />;
}

interface SystemAlert {
  id: string;
  service: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: Date | string;
}

interface SystemHealthProps {
  alerts: SystemAlert[];
}

export function SystemHealthWidget({ alerts }: SystemHealthProps) {
  const formattedAlerts: Alert[] = alerts.map(alert => ({
    id: alert.id,
    type: 
      alert.severity === 'critical' ? 'error' :
      alert.severity === 'high' ? 'warning' :
      alert.severity === 'medium' ? 'info' : 'success',
    title: alert.service,
    message: alert.message,
    timestamp: alert.timestamp,
  }));

  return <AlertWidget alerts={formattedAlerts} title="System Health" />;
}
