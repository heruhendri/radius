import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { RouterOSAPI } from 'node-routeros';

const CMD_TIMEOUT = 12_000; // 12 seconds per command

/** Wraps api.write with per-command timeout + error capture (same pattern as vpn-server/setup) */
async function apiCmd(api: any, command: string, params: string[] = [], label = command): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const data = await Promise.race([
      api.write(command, params),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Command timeout (${CMD_TIMEOUT / 1000}s): ${label}`)), CMD_TIMEOUT)
      ),
    ]);
    // Check if RouterOS returned a !trap (error) in the response data
    if (Array.isArray(data)) {
      const trap = data.find((item: any) => item['!trap'] || (item['message'] && item['type'] === 'error'));
      if (trap) {
        return { ok: false, error: trap['message'] || trap['!trap'] || JSON.stringify(trap) };
      }
    }
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
// GET - List all active routers (for picker UI)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const routers = await prisma.router.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nasname: true, ipAddress: true, shortname: true, description: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ routers });
  } catch (error) {
    console.error('Get routers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Test connection to a router (diagnostic — tests identity + PPP read/write access)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { routerId } = await request.json();
    const router = routerId
      ? await prisma.router.findUnique({ where: { id: routerId } })
      : await prisma.router.findFirst({ where: { isActive: true } });

    if (!router) return NextResponse.json({ error: 'Router tidak ditemukan' }, { status: 404 });

    const host = router.ipAddress || router.nasname;
    const portsToTry = [router.port || 8728, router.apiPort || 8729].filter((p, i, arr) => arr.indexOf(p) === i);

    type PortResult = {
      port: number; success: boolean; identity?: string;
      pppRead?: boolean; pppReadError?: string;
      pppWrite?: boolean; pppWriteError?: string;
      error?: string;
    };
    const results: PortResult[] = [];

    for (const port of portsToTry) {
      const api = new RouterOSAPI({ host, port, user: router.username, password: router.password, timeout: 10 });
      const r: PortResult = { port, success: false };
      try {
        await Promise.race([
          api.connect(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout 10s`)), 10000)),
        ]);

        // Test 1: identity
        const identity = await api.write('/system/identity/print');
        r.identity = identity[0]?.name || 'unknown';
        r.success = true;

        // Test 2: PPP profile read
        try {
          const profiles = await api.write('/ppp/profile/print');
          r.pppRead = true;
          r.pppReadError = `OK (${Array.isArray(profiles) ? profiles.length : '?'} profiles)`;
        } catch (e: any) {
          r.pppRead = false;
          r.pppReadError = e?.message || String(e);
        }

        // Test 3: PPP profile write (try to add then immediately remove a test profile)
        const testProfileName = `__salfanet_test_${Date.now()}`;
        try {
          const addResult = await api.write('/ppp/profile/add', [`=name=${testProfileName}`]);
          // If add succeeded, clean up
          try {
            const testProfile = await api.write('/ppp/profile/print');
            const found = Array.isArray(testProfile) ? testProfile.find((p: any) => p['name'] === testProfileName) : null;
            if (found) await api.write('/ppp/profile/remove', [`=.id=${found['.id']}`]);
          } catch { /* ignore cleanup error */ }
          r.pppWrite = true;
          r.pppWriteError = 'OK';
        } catch (e: any) {
          r.pppWrite = false;
          r.pppWriteError = e?.message || String(e);
        }

        await api.close();
      } catch (e: any) {
        try { await api.close(); } catch { /* ignore */ }
        r.error = e?.message || String(e);
      }
      results.push(r);
    }

    const bestResult = results.find(r => r.success);
    const anySuccess = !!bestResult;

    let hint: string | null = null;
    if (!anySuccess) {
      hint = `Tidak bisa konek ke ${host}.\nPastikan:\n1. /ip service api enabled=yes di MikroTik\n2. Port ${portsToTry.join('/')} tidak diblokir firewall\n3. IP dan kredensial benar`;
    } else if (bestResult && !bestResult.pppRead) {
      hint = `Koneksi berhasil tapi tidak bisa baca /ppp/profile.\nPastikan user "${router.username}" di MikroTik ada di group dengan policy=read,write,api`;
    } else if (bestResult && !bestResult.pppWrite) {
      hint = `Bisa baca tapi tidak bisa menulis /ppp/profile.\nPastikan user "${router.username}" di MikroTik ada di group dengan policy=write`;
    }

    return NextResponse.json({
      success: anySuccess,
      host,
      user: router.username,
      routerName: router.name || router.nasname,
      results,
      hint,
    }, { status: anySuccess ? 200 : 502 });
  } catch (error) {
    console.error('Test router error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, routerId, ipPoolName, localAddress } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const profile = await prisma.pppoeProfile.findUnique({ where: { id } }) as any;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const rateLimit = profile.rateLimit || `${profile.downloadSpeed}M/${profile.uploadSpeed}M`;
    const resolvedMikrotikProfileName = String(profile.groupName || profile.name).trim();
    const resolvedIpPoolName = typeof ipPoolName === 'string' ? ipPoolName.trim() : (profile.ipPoolName || '');
    const resolvedLocalAddress = typeof localAddress === 'string' ? localAddress.trim() : '';

    if (!resolvedMikrotikProfileName) {
      return NextResponse.json({ error: 'Nama PPP Profile MikroTik wajib diisi' }, { status: 400 });
    }

    // Get router — use specified router or first active router
    const router = routerId
      ? await prisma.router.findUnique({ where: { id: routerId } })
      : await prisma.router.findFirst({ where: { isActive: true } });

    if (!router) {
      return NextResponse.json({ error: 'Tidak ada router aktif ditemukan. Tambahkan router di menu NAS/Router terlebih dahulu.' }, { status: 404 });
    }

    const host = router.ipAddress || router.nasname;
    const primaryPort = router.port || 8728;
    const fallbackPort = router.apiPort || 8729;

    const connectAndSync = async (port: number): Promise<{ port: number; action: string; profileName: string; debug: string[]; warnings: string[] }> => {
      const api = new RouterOSAPI({
        host,
        port,
        user: router.username,
        password: router.password,
        timeout: 15,
      });

      const debug: string[] = [];
      const warnings: string[] = [];

      await Promise.race([
        api.connect(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Connection timed out (15s) to ${host}:${port}`)), 15000)),
      ]);
      debug.push(`✅ Connected to ${host}:${port} (user: ${router.username})`);

      try {
        // Fetch all profiles
        const printResult = await apiCmd(api, '/ppp/profile/print', [], 'profile/print');
        if (!printResult.ok) throw new Error(`Gagal baca profile list: ${printResult.error}`);

        const allProfiles: any[] = printResult.data || [];
        const existingProfile = allProfiles.find((p: any) => p['name'] === resolvedMikrotikProfileName);
        debug.push(`📋 Profiles di MikroTik: ${allProfiles.length}, target: "${resolvedMikrotikProfileName}", exists: ${!!existingProfile}`);

        const sharedUserLimit = profile.sharedUser ? 'no' : 'yes';

        // Helper: try write with pool/IP params, fallback to without if RouterOS rejects them
        const tryWrite = async (command: string, params: string[]): Promise<string[]> => {
          debug.push(`📝 ${command}: ${params.join(' ')}`);
          const result = await apiCmd(api, command, params, command);
          if (result.ok) return params;

          const errLower = (result.error || '').toLowerCase();
          const isPoolError = errLower.includes('no such item') || errLower.includes('invalid ip') || errLower.includes('bad ip');

          // If error is related to pool/localAddress, strip those and retry
          if (isPoolError && (resolvedIpPoolName || resolvedLocalAddress)) {
            const reduced = params.filter(p => !p.startsWith('=remote-address=') && !p.startsWith('=local-address='));
            debug.push(`⚠️ Pool/IP error: ${result.error} — retrying without pool/localAddress`);
            warnings.push(`Pool "${resolvedIpPoolName}" atau Local IP "${resolvedLocalAddress}" tidak ditemukan di MikroTik — profile disimpan tanpa remote-address/local-address`);
            const retry = await apiCmd(api, command, reduced, command + ' (no pool)');
            if (!retry.ok) throw new Error(`${command} gagal: ${retry.error}`);
            return reduced;
          }

          throw new Error(`${command} gagal: ${result.error}`);
        };

        let action: string;

        if (existingProfile) {
          const profileId = existingProfile['.id'];
          debug.push(`🔄 Update existing profile id=${profileId}`);
          const updateParams: string[] = [`=.id=${profileId}`, `=rate-limit=${rateLimit}`, `=only-one=${sharedUserLimit}`];
          if (resolvedIpPoolName) updateParams.push(`=remote-address=${resolvedIpPoolName}`);
          if (resolvedLocalAddress) updateParams.push(`=local-address=${resolvedLocalAddress}`);
          await tryWrite('/ppp/profile/set', updateParams);
          action = 'updated';
        } else {
          debug.push(`➕ Creating new profile`);
          const createParams: string[] = [`=name=${resolvedMikrotikProfileName}`, `=rate-limit=${rateLimit}`, `=only-one=${sharedUserLimit}`];
          if (resolvedIpPoolName) createParams.push(`=remote-address=${resolvedIpPoolName}`);
          if (resolvedLocalAddress) createParams.push(`=local-address=${resolvedLocalAddress}`);
          await tryWrite('/ppp/profile/add', createParams);
          action = 'created';
        }

        await api.close();
        return { port, action, profileName: resolvedMikrotikProfileName, debug, warnings };
      } catch (e) {
        try { await api.close(); } catch { /* ignore */ }
        throw e;
      }
    };

    let syncResult: { port: number; action: string; profileName: string; debug: string[]; warnings: string[] };
    try {
      try {
        syncResult = await connectAndSync(primaryPort);
      } catch (e1: any) {
        if (fallbackPort === primaryPort) throw e1;
        console.warn(`[SyncMikroTik] Port ${primaryPort} gagal (${e1?.message}), coba port ${fallbackPort}...`);
        syncResult = await connectAndSync(fallbackPort);
      }

      // Save sync config to DB (non-critical)
      try {
        await prisma.pppoeProfile.update({
          where: { id },
          data: {
            mikrotikProfileName: resolvedMikrotikProfileName,
            ipPoolName: resolvedIpPoolName || null,
            localAddress: resolvedLocalAddress || null,
            lastRouterId: router.id,
          },
        } as any);
      } catch (dbErr: any) {
        console.warn('[SyncMikroTik] DB update gagal (mungkin migrasi belum dijalankan):', dbErr?.message);
      }

      const actionLabel = syncResult.action === 'created' ? 'dibuat' : 'diperbarui';
      const warningText = syncResult.warnings.length ? `\n\n⚠️ Peringatan:\n${syncResult.warnings.join('\n')}` : '';
      return NextResponse.json({
        success: true,
        message: `✅ PPP Profile "${resolvedMikrotikProfileName}" berhasil ${actionLabel} di MikroTik ${host}:${syncResult.port}${resolvedIpPoolName ? ` | Pool: ${resolvedIpPoolName}` : ''}${resolvedLocalAddress ? ` | Local IP: ${resolvedLocalAddress}` : ''}${warningText}`,
        debug: syncResult.debug,
        warnings: syncResult.warnings,
        router: { id: router.id, name: router.name || router.nasname, ip: host, port: syncResult.port },
      });
    } catch (mkError: any) {
      const errMsg = mkError?.message || String(mkError);
      console.error('[SyncMikroTik] MikroTik API error:', errMsg);
      return NextResponse.json({
        error: `Gagal sync ke MikroTik (${host}): ${errMsg}`,
        host,
        portsAttempted: [primaryPort, fallbackPort !== primaryPort ? fallbackPort : null].filter(Boolean),
      }, { status: 502 });
    }
  } catch (error) {
    console.error('Sync MikroTik error:', error);
    return NextResponse.json({ error: 'Gagal sinkronisasi ke MikroTik' }, { status: 500 });
  }
}
