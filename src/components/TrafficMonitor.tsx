'use client';

import { useState, useEffect } from 'react';
import { Activity, ArrowUp, ArrowDown, Wifi, WifiOff } from 'lucide-react';

interface InterfaceTraffic {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
  rxPackets: number;
  txPackets: number;
  running: boolean;
}

interface RouterTraffic {
  routerId: string;
  routerName: string;
  interfaces: InterfaceTraffic[];
  error?: string;
}

interface TrafficData {
  routers: RouterTraffic[];
  timestamp: string;
}

interface PreviousData {
  [key: string]: {
    rxBytes: number;
    txBytes: number;
    timestamp: number;
  };
}

export default function TrafficMonitor() {
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousData, setPreviousData] = useState<PreviousData>({});
  const [selectedRouterId, setSelectedRouterId] = useState<string | 'all'>('all');

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatBitrate = (bytesPerSecond: number): string => {
    const bitsPerSecond = bytesPerSecond * 8;
    if (bitsPerSecond === 0) return '0 bps';
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
    return `${(bitsPerSecond / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const calculateRate = (
    routerId: string,
    interfaceName: string,
    currentRx: number,
    currentTx: number,
    currentTime: number
  ): { rxRate: number; txRate: number } => {
    const key = `${routerId}-${interfaceName}`;
    const prev = previousData[key];

    if (!prev) {
      return { rxRate: 0, txRate: 0 };
    }

    const timeDiff = (currentTime - prev.timestamp) / 1000; // seconds
    if (timeDiff <= 0) {
      return { rxRate: 0, txRate: 0 };
    }

    const rxRate = (currentRx - prev.rxBytes) / timeDiff;
    const txRate = (currentTx - prev.txBytes) / timeDiff;

    return {
      rxRate: Math.max(0, rxRate),
      txRate: Math.max(0, txRate),
    };
  };

  const fetchTraffic = async () => {
    try {
      const response = await fetch('/api/dashboard/traffic');
      const data = await response.json();

      if (data.success) {
        const currentTime = Date.now();
        const newPreviousData: PreviousData = {};

        // Calculate rates and update previous data
        data.routers.forEach((router: RouterTraffic) => {
          router.interfaces.forEach((iface) => {
            const key = `${router.routerId}-${iface.name}`;
            const rates = calculateRate(
              router.routerId,
              iface.name,
              iface.rxBytes,
              iface.txBytes,
              currentTime
            );

            iface.rxRate = rates.rxRate;
            iface.txRate = rates.txRate;

            newPreviousData[key] = {
              rxBytes: iface.rxBytes,
              txBytes: iface.txBytes,
              timestamp: currentTime,
            };
          });
        });

        setPreviousData(newPreviousData);
        setTraffic(data);
        setError(null);
      } else {
        setError(data.message || 'Failed to fetch traffic data');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraffic();
    const interval = setInterval(fetchTraffic, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary animate-pulse" />
          <h3 className="text-lg font-semibold text-foreground">
            Traffic Monitor MikroTik
          </h3>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading traffic data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3 className="text-lg font-semibold text-foreground">
            Traffic Monitor MikroTik
          </h3>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!traffic || traffic.routers.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">
            Traffic Monitor MikroTik
          </h3>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">No active routers found</p>
        </div>
      </div>
    );
  }

  // Filter routers based on selection
  const filteredRouters = selectedRouterId === 'all' 
    ? traffic.routers 
    : traffic.routers.filter(r => r.routerId === selectedRouterId);

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Traffic Monitor MikroTik
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Router Selector */}
          <select
            value={selectedRouterId}
            onChange={(e) => setSelectedRouterId(e.target.value)}
            className="text-xs px-3 py-1.5 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Semua Router</option>
            {traffic.routers.map((router) => (
              <option key={router.routerId} value={router.routerId}>
                {router.routerName}
              </option>
            ))}
          </select>
          
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {filteredRouters.map((router) => (
          <div key={router.routerId} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground">
                {router.routerName}
              </h4>
              {router.error && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  {router.error}
                </span>
              )}
            </div>

            {router.interfaces.length === 0 ? (
              <p className="text-xs text-muted-foreground">No interfaces found</p>
            ) : (
              <div className="space-y-2">
                {router.interfaces
                  .filter((iface) => iface.running) // Only show running interfaces
                  .slice(0, 5) // Show top 5 interfaces
                  .map((iface) => (
                    <div
                      key={iface.name}
                      className="bg-muted rounded-lg p-3 border border-border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {iface.running ? (
                            <Wifi className="w-4 h-4 text-green-500" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium text-foreground">
                            {iface.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ArrowDown className="w-3 h-3 text-primary" />
                            <span>{formatBitrate(iface.rxRate)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ArrowUp className="w-3 h-3 text-green-500" />
                            <span>{formatBitrate(iface.txRate)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          RX: {formatBytes(iface.rxBytes)} ({iface.rxPackets.toLocaleString()} packets)
                        </span>
                        <span>
                          TX: {formatBytes(iface.txBytes)} ({iface.txPackets.toLocaleString()} packets)
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Auto-refresh every 3 seconds
        </p>
      </div>
    </div>
  );
}
