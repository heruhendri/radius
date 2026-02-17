import { prisma } from './prisma';
import { SessionMonitor } from './session-monitor';

export const AuthMonitor = {
  /**
   * Monitor and log authentication attempts
   */
  async logAuthAttempt(data: {
    username: string;
    ipAddress: string;
    success: boolean;
    reason?: string;
    userAgent?: string;
  }) {
    try {
      // Log to activity log
      const { logActivity } = await import('./activity-log');
      await logActivity({
        username: data.username,
        userRole: 'customer',
        action: data.success ? 'login_success' : 'login_failed',
        description: data.success 
          ? `Successful login from ${data.ipAddress}` 
          : `Failed login: ${data.reason || 'Authentication failed'}`,
        module: 'auth',
        status: data.success ? 'success' : 'warning',
        ipAddress: data.ipAddress,
        metadata: {
          userAgent: data.userAgent,
          reason: data.reason,
        },
      });

      // Check for suspicious activity after login attempts
      if (!data.success) {
        await SessionMonitor.checkSuspiciousActivity(data.username, data.ipAddress);
      }

    } catch (error) {
      console.error('[Auth Monitor] Error logging auth attempt:', error);
    }
  },

  /**
   * Monitor concurrent sessions
   */
  async checkConcurrentSessions(username: string, newIpAddress: string) {
    try {
      const activeSessions = await prisma.radacct.findMany({
        where: {
          username: username,
          acctstoptime: null,
        },
        select: {
          framedipaddress: true,
          nasipaddress: true,
          acctstarttime: true,
        },
      });

      if (activeSessions.length > 1) {
        const { logActivity } = await import('./activity-log');
        await logActivity({
          username: username,
          userRole: 'customer',
          action: 'concurrent_sessions',
          description: `User has ${activeSessions.length} concurrent active sessions`,
          module: 'auth',
          status: 'warning',
          ipAddress: newIpAddress,
          metadata: {
            sessionCount: activeSessions.length,
            sessions: activeSessions.map((s: any) => ({
              ip: s.framedipaddress,
              nas: s.nasipaddress,
              startTime: s.acctstarttime,
            })),
          },
        });
      }

    } catch (error) {
      console.error('[Auth Monitor] Error checking concurrent sessions:', error);
    }
  },

  /**
   * Monitor for brute force attacks by username
   */
  async checkBruteForceAttack(username: string) {
    try {
      const recentFailures = await prisma.radpostauth.count({
        where: {
          username: username,
          reply: 'Access-Reject',
          authdate: {
            gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
          },
        },
      });

      if (recentFailures >= 10) {
        const { NotificationService } = await import('./notifications');
        await NotificationService.notifySuspiciousActivity({
          username: username,
          activity: `Possible brute force attack: ${recentFailures} failed attempts in 15 minutes`,
        });

        const { logActivity } = await import('./activity-log');
        await logActivity({
          username: 'system',
          userRole: 'system',
          action: 'brute_force_detected',
          description: `Brute force attack detected for user ${username}: ${recentFailures} failed attempts`,
          module: 'auth',
          status: 'error',
        });
      }

    } catch (error) {
      console.error('[Auth Monitor] Error checking brute force:', error);
    }
  },
};