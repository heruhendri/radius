import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('src/app/technician/TechnicianPortalLayout.tsx', 'utf8');

// 1. Add BellOff import
c = c.replace('  Bell,\n  Cpu,', '  Bell,\n  BellOff,\n  Cpu,');

// 2. Find and replace the PushNotificationBanner section
const bannerStart = c.indexOf('/* --- Push Notification Banner --- */');
const bellStart = c.indexOf('function NotificationBell()');
if (bannerStart < 0 || bellStart < 0) {
  console.error('Could not find markers:', { bannerStart, bellStart });
  process.exit(1);
}
const oldBanner = c.substring(bannerStart, bellStart);
console.log('Old banner length:', oldBanner.length);

const newToggle = `/* --- Sidebar Push Notification Toggle --- */
function SidebarPushToggle({ techId }: { techId: string }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
  };

  const doSubscribe = async () => {
    if (!techId) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const vapidRes = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await vapidRes.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch('/api/push/technician-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: techId, subscription: sub.toJSON() }),
      });
      setSubscribed(true);
    } catch (e) {
      console.error('[SidebarPush] Subscribe error:', e);
    } finally {
      setLoading(false);
    }
  };

  const doUnsubscribe = async () => {
    if (!techId) return;
    setLoading(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await fetch('/api/push/technician-unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ technicianId: techId, endpoint }),
          });
        }
      }
      setSubscribed(false);
    } catch (e) {
      console.error('[SidebarPush] Unsubscribe error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !techId) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in navigator)) {
      setPermission('unsupported');
      return;
    }
    const perm = Notification.permission;
    setPermission(perm);
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setSubscribed(!!sub))
      .catch(() => {});
  }, [techId]);

  const handleToggle = async () => {
    if (permission === 'unsupported' || permission === 'denied') return;
    if (subscribed) {
      await doUnsubscribe();
    } else {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        setPermission(perm as NotificationPermission);
        if (perm !== 'granted') return;
      }
      await doSubscribe();
    }
  };

  if (permission === 'unsupported') return null;

  const isDenied = permission === 'denied';
  const isOn = subscribed && permission === 'granted';

  return (
    <button
      onClick={handleToggle}
      disabled={loading || isDenied}
      title={isDenied ? 'Notifikasi diblokir di browser' : isOn ? 'Nonaktifkan notifikasi push' : 'Aktifkan notifikasi push'}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all duration-300 border',
        isDenied
          ? 'text-slate-400 dark:text-slate-600 bg-transparent border-transparent cursor-not-allowed opacity-50'
          : isOn
          ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20'
          : 'text-slate-500 dark:text-slate-400 bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-cyan-500/10 hover:border-slate-200 dark:hover:border-cyan-500/20',
      )}
    >
      <span className={cn('p-1.5 rounded-lg flex-shrink-0 flex items-center justify-center transition-all', isOn ? 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' : 'text-slate-400 dark:text-slate-400')}>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isOn ? (
          <Bell className="w-4 h-4" />
        ) : (
          <BellOff className="w-4 h-4" />
        )}
      </span>
      <span className="flex-1 text-left tracking-wide">Notif Push</span>
      <span className={cn(
        'relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border-2 transition-colors duration-200',
        isDenied
          ? 'border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700'
          : isOn
          ? 'border-cyan-500 bg-cyan-500'
          : 'border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700',
      )}>
        <span className={cn(
          'pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform duration-200',
          isOn ? 'translate-x-3' : 'translate-x-0',
        )} />
      </span>
    </button>
  );
}

`;

c = c.replace(oldBanner, newToggle);

// 3. Remove PushNotificationBanner JSX usage in layout (replace with SidebarPushToggle in sidebar)
//    Find and remove {tech && <PushNotificationBanner techId={tech.id} />} from main content area
c = c.replace(
  /\s*\{\/\* Push Notification Banner \*\/\}\s*\{tech && <PushNotificationBanner techId=\{tech\.id\} \/>\}\s*/g,
  '\n        '
);

// 4. Add SidebarPushToggle in TechSidebar's bottom section (before Logout button)
// It already gets tech as prop -- pass tech?.id
c = c.replace(
  `          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-all duration-300"`,
  `          {tech && <SidebarPushToggle techId={tech.id} />}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-all duration-300"`
);

console.log('Has SidebarPushToggle component:', c.includes('function SidebarPushToggle'));
console.log('Has toggle in sidebar:', c.includes('SidebarPushToggle techId={tech.id}'));
console.log('BellOff added:', c.includes('BellOff,'));

writeFileSync('src/app/technician/TechnicianPortalLayout.tsx', c, 'utf8');
console.log('Done. Length:', c.length);
