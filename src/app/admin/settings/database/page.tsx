'use client';

import { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Send,
  Trash2,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Shield,
  Loader2,
} from 'lucide-react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { usePermissions } from '@/hooks/usePermissions';
import { formatWIB } from '@/lib/timezone';
import { useTranslation } from '@/hooks/useTranslation';

interface BackupHistory {
  id: string;
  filename: string;
  filesize: number;
  type: 'auto' | 'manual';
  status: 'success' | 'failed';
  method: string;
  createdAt: string;
  error?: string;
}

interface DatabaseHealth {
  status: 'healthy' | 'warning' | 'error';
  size: string;
  tables: number;
  connections: string;
  lastBackup: string | null;
  uptime: string;
}

interface TelegramSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
  backupTopicId: string;
  healthTopicId: string;
  schedule: string;
  scheduleTime: string;
  keepLastN: number;
}

export default function DatabaseSettingsPage() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'backup' | 'telegram'>('backup');
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>({
    enabled: false,
    botToken: '',
    chatId: '',
    backupTopicId: '',
    healthTopicId: '',
    schedule: 'daily',
    scheduleTime: '02:00',
    keepLastN: 7,
  });

  useEffect(() => {
    if (hasPermission('settings.view')) {
      loadData();
    }
  }, [hasPermission]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load backup history
      const historyRes = await fetch('/api/backup/history');
      const historyData = await historyRes.json();
      if (historyData.success) {
        setBackupHistory(historyData.history);
      }

      // Load DB health
      const healthRes = await fetch('/api/backup/health');
      const healthData = await healthRes.json();
      if (healthData.success) {
        setDbHealth(healthData.health);
      }

      // Load Telegram settings
      const settingsRes = await fetch('/api/telegram/settings');
      const settingsData = await settingsRes.json();
      setTelegramSettings(settingsData);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackupNow = async () => {
    const confirmed = await showConfirm(t('settings.createBackupConfirm'));
    if (!confirmed) return;

    setBacking(true);
    try {
      const res = await fetch('/api/backup/create', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        await showSuccess(t('settings.backupCreated'));
        loadData();
        
        // Download file
        if (data.downloadUrl) {
          const link = document.createElement('a');
          link.href = data.downloadUrl;
          link.download = data.filename;
          link.click();
        }
      } else {
        await showError(data.error || t('settings.backupFailed'));
      }
    } catch (error) {
      await showError(t('settings.createBackupFailed') + ': ' + error);
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      await showError(t('settings.selectBackupFileFirst'));
      return;
    }

    const confirmed = await showConfirm(
      t('settings.restoreDoubleConfirm')
    );
    if (!confirmed) return;

    const doubleConfirm = await showConfirm(
      'Last confirmation: Type YES to proceed with database restore.',
      'Final Confirmation'
    );
    if (!doubleConfirm) return;

    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.success) {
        await showSuccess(t('settings.restorePageReload'));
        setTimeout(() => window.location.reload(), 2000);
      } else {
        await showError(data.error || t('settings.restoreFailed'));
      }
    } catch (error) {
      await showError(t('settings.failedRestore') + ': ' + error);
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async (id: string, filename: string) => {
    const confirmed = await showConfirm(`${t('settings.deleteBackupConfirm')}: ${filename}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/backup/delete/${id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        await showSuccess(t('settings.backupDeleted'));
        loadData();
      } else {
        await showError(data.error || t('settings.deleteFailed'));
      }
    } catch (error) {
      await showError(t('settings.deleteBackupFailed') + ': ' + error);
    }
  };

  const handleSaveTelegramSettings = async () => {
    try {
      const res = await fetch('/api/telegram/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramSettings),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Restart cron jobs to apply new settings
        await fetch('/api/cron/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restart', job: 'all' }),
        });
        
        await showSuccess(t('settings.telegramTestSuccess'));
        loadData();
      } else {
        await showError(data.error || t('common.saveFailed'));
      }
    } catch (error) {
      await showError(t('common.failedSave') + ': ' + error);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramSettings.botToken || !telegramSettings.chatId) {
      await showError(t('settings.enterTokenChatIdFirst'));
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramSettings.botToken,
          chatId: telegramSettings.chatId,
          backupTopicId: telegramSettings.backupTopicId || undefined,
          healthTopicId: telegramSettings.healthTopicId || undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        const count = data.results?.length || 0;
        await showSuccess(t('settings.telegramTestSuccess'));
      } else {
        await showError(data.error || t('settings.telegramTestFailed'));
      }
    } catch (error) {
      await showError(t('settings.failedTest') + ': ' + error);
    } finally {
      setTesting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Permission check
  const canView = hasPermission('settings.view');
  const canEdit = hasPermission('settings.edit');

  if (!permLoading && !canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div><div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div><div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div><div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div></div>
        <div className="relative z-10 text-center">
          <Shield className="w-16 h-16 text-[#ff3366] drop-shadow-[0_0_20px_rgba(255,51,102,0.6)] mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent mb-2">
            Access Denied
          </h2>
          <p className="text-muted-foreground">
            You don't have permission to view database settings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div><div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div><div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div><div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div></div>
        <Loader2 className="w-12 h-12 animate-spin text-[#00f7ff] drop-shadow-[0_0_20px_rgba(0,247,255,0.6)] relative z-10" />
      </div>
    );
  }

  return (
    <div className="bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div><div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div><div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div><div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div></div>
      <div className="relative z-10 space-y-6">
        {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)]">
          <Database className="w-6 h-6 text-[#00f7ff] inline mr-2" />
          Database Management
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Backup, restore, and monitor your database
        </p>
      </div>

      {/* Database Health Status */}
      {dbHealth && (
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Database Health
            </h2>
            <div className="flex items-center gap-2">
              {dbHealth.status === 'healthy' && (
                <span className="flex items-center gap-1 text-success dark:text-success">
                  <CheckCircle className="w-5 h-5" />
                  Healthy
                </span>
              )}
              {dbHealth.status === 'warning' && (
                <span className="flex items-center gap-1 text-warning dark:text-warning">
                  <AlertCircle className="w-5 h-5" />
                  Warning
                </span>
              )}
              {dbHealth.status === 'error' && (
                <span className="flex items-center gap-1 text-destructive dark:text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  Error
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('settings.databaseSize')}</p>
              <p className="text-lg font-semibold text-foreground">{dbHealth.size}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('settings.tablesLabel')}</p>
              <p className="text-lg font-semibold text-foreground">{dbHealth.tables}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('settings.connectionsLabel')}</p>
              <p className="text-lg font-semibold text-foreground">{dbHealth.connections}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('settings.lastBackup')}</p>
              <p className="text-lg font-semibold text-foreground">
                {dbHealth.lastBackup ? formatWIB(dbHealth.lastBackup, 'dd/MM HH:mm') : 'Never'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('settings.uptimeLabel')}</p>
              <p className="text-lg font-semibold text-foreground">{dbHealth.uptime}</p>
            </div>
            <div>
              <button
                onClick={loadData}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition flex items-center justify-center gap-2 text-muted-foreground"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-2 border-b-2 transition ${
              activeTab === 'backup'
                ? 'border-primary text-primary dark:text-violet-200 font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Backup & Restore
            </div>
          </button>
          <button
            onClick={() => setActiveTab('telegram')}
            className={`px-4 py-2 border-b-2 transition ${
              activeTab === 'telegram'
                ? 'border-primary text-primary dark:text-violet-200 font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Telegram Auto-Backup
            </div>
          </button>
        </div>
      </div>

      {/* Backup Tab */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Manual Backup/Restore */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Backup Card */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Create Backup
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Download a complete backup of your database as SQL file
              </p>
              <button
                onClick={handleBackupNow}
                disabled={backing || !canEdit}
                className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 text-white rounded-lg transition flex items-center justify-center gap-2 font-medium"
              >
                {backing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Backup Now
                  </>
                )}
              </button>
            </div>

            {/* Restore Card */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Restore Database
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload and restore database from backup file (.sql)
              </p>
              <input
                type="file"
                accept=".sql"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="block w-full text-sm mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 dark:file:bg-gray-700 dark:file:text-violet-200"
                disabled={!canEdit}
              />
              <button
                onClick={handleRestore}
                disabled={!restoreFile || restoring || !canEdit}
                className="w-full px-4 py-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:opacity-50 text-white rounded-lg transition flex items-center justify-center gap-2 font-medium"
              >
                {restoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Restore Database
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Backup History */}
          <div className="bg-card rounded-lg border border-border shadow-sm">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Backup History
              </h3>
            </div>
            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3 p-4">
              {backupHistory.length === 0 ? (
                <div className="bg-card/80 backdrop-blur-xl rounded-xl border border-[#bc13fe]/20 p-3 text-center text-sm text-muted-foreground">
                  No backup history yet
                </div>
              ) : (
                backupHistory.map((backup) => (
                  <div key={backup.id} className="bg-card/80 backdrop-blur-xl rounded-xl border border-[#bc13fe]/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          backup.type === 'auto'
                            ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-violet-200'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {backup.type}
                      </span>
                      {backup.status === 'success' ? (
                        <span className="flex items-center gap-1 text-success dark:text-success text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Success
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-destructive dark:text-destructive text-xs">
                          <AlertCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span className="text-foreground">{formatWIB(backup.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Filename</span>
                        <span className="text-foreground font-mono text-xs truncate max-w-[180px]">{backup.filename}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size</span>
                        <span className="text-foreground">{formatFileSize(backup.filesize)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border">
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = `/api/backup/download/${backup.id}`;
                          link.download = backup.filename;
                          link.click();
                        }}
                        className="text-primary hover:text-primary/80 dark:text-violet-200 dark:hover:text-violet-100 text-xs flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteBackup(backup.id, backup.filename)}
                          className="text-destructive hover:text-destructive dark:hover:text-red-300 text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Filename
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {backupHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No backup history yet
                      </td>
                    </tr>
                  ) : (
                    backupHistory.map((backup) => (
                      <tr key={backup.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4 text-sm text-foreground">
                          {formatWIB(backup.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-foreground">
                          {backup.filename}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {formatFileSize(backup.filesize)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              backup.type === 'auto'
                                ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-violet-200'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {backup.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {backup.status === 'success' ? (
                            <span className="flex items-center gap-1 text-success dark:text-success">
                              <CheckCircle className="w-4 h-4" />
                              Success
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-destructive dark:text-destructive">
                              <AlertCircle className="w-4 h-4" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `/api/backup/download/${backup.id}`;
                                link.download = backup.filename;
                                link.click();
                              }}
                              className="text-primary hover:text-primary/80 dark:text-violet-200 dark:hover:text-violet-100"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteBackup(backup.id, backup.filename)}
                                className="text-destructive hover:text-destructive dark:hover:text-red-300"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Tab */}
      {activeTab === 'telegram' && (
        <div className="space-y-6">
          <div className="bg-card rounded-lg border border-border shadow-sm p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Send className="w-5 h-5" />
              Telegram Auto-Backup Configuration
            </h3>

            <div className="space-y-4">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <label className="font-medium text-foreground">{t('settings.enableAutoBackup')}</label>
                  <p className="text-sm text-muted-foreground">{t('settings.autoBackupDesc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={telegramSettings.enabled}
                    onChange={(e) =>
                      setTelegramSettings({ ...telegramSettings, enabled: e.target.checked })
                    }
                    className="sr-only peer"
                    disabled={!canEdit}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Bot Token */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  value={telegramSettings.botToken || ''}
                  onChange={(e) =>
                    setTelegramSettings({ ...telegramSettings, botToken: e.target.value })
                  }
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get token from @BotFather on Telegram
                </p>
              </div>

              {/* Chat ID */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Chat ID (Group)
                </label>
                <input
                  type="text"
                  value={telegramSettings.chatId || ''}
                  onChange={(e) =>
                    setTelegramSettings({ ...telegramSettings, chatId: e.target.value })
                  }
                  placeholder="-1001234567890"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get Chat ID from @userinfobot or your group
                </p>
              </div>

              {/* Backup Topic ID */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Backup Topic ID
                </label>
                <input
                  type="text"
                  value={telegramSettings.backupTopicId || ''}
                  onChange={(e) =>
                    setTelegramSettings({ ...telegramSettings, backupTopicId: e.target.value })
                  }
                  placeholder="123"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Topic ID for backup messages (right-click topic → Copy Link → extract ID)
                </p>
              </div>

              {/* Health Topic ID */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Health Topic ID (Optional)
                </label>
                <input
                  type="text"
                  value={telegramSettings.healthTopicId || ''}
                  onChange={(e) =>
                    setTelegramSettings({ ...telegramSettings, healthTopicId: e.target.value })
                  }
                  placeholder="456"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Topic ID for health check reports
                </p>
              </div>

              {/* Schedule */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Schedule
                  </label>
                  <select
                    value={telegramSettings.schedule || 'daily'}
                    onChange={(e) =>
                      setTelegramSettings({ ...telegramSettings, schedule: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    disabled={!canEdit}
                  >
                    <option value="daily">{t('settings.dailyOption')}</option>
                    <option value="12h">{t('settings.every12Hours')}</option>
                    <option value="6h">{t('settings.every6Hours')}</option>
                    <option value="weekly">{t('settings.weeklySunday')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Time (WIB)
                  </label>
                  <input
                    type="time"
                    value={telegramSettings.scheduleTime || '00:00'}
                    onChange={(e) =>
                      setTelegramSettings({ ...telegramSettings, scheduleTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {/* Keep Last N */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Keep Last Backups
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={telegramSettings.keepLastN || 7}
                  onChange={(e) =>
                    setTelegramSettings({ ...telegramSettings, keepLastN: parseInt(e.target.value) || 7 })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically delete old backups, keep only last N files
                </p>
              </div>

              {/* Action Buttons */}
              {canEdit && (
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button
                    onClick={handleTestTelegram}
                    disabled={testing}
                    className="px-4 py-2 border border-primary text-primary dark:text-violet-200 hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Test Connection
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSaveTelegramSettings}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-white rounded-lg transition"
                  >
                    Save Settings
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-primary/10 dark:bg-primary/20 border border-primary/30 dark:border-primary/40 rounded-lg p-4">
            <h4 className="font-medium text-foreground dark:text-violet-200 mb-2">
              📘 How to Setup Telegram Backup
            </h4>
            <ol className="text-sm text-foreground dark:text-violet-100 space-y-1 list-decimal list-inside">
              <li>Create a bot via @BotFather on Telegram and get the Bot Token</li>
              <li>Create a group, add your bot as admin</li>
              <li>Enable Topics in group settings</li>
              <li>Create topics: "Backup" and "Health"</li>
              <li>Get Chat ID from @getidsbot in your group</li>
              <li>Right-click each topic → Copy Link → extract topic ID from URL</li>
              <li>Enter all credentials above and click "Test"</li>
              <li>Click "Test Backup" to send actual backup file</li>
              <li>Enable auto-backup and save settings</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
