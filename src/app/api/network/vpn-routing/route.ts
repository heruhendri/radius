import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(req: Request) {
  try {
    const { host, port, username, password, script } = await req.json();

    if (!host || !username || !password) {
      return NextResponse.json(
        { success: false, message: 'host, username, dan password wajib diisi' },
        { status: 400 }
      );
    }
    if (!script) {
      return NextResponse.json(
        { success: false, message: 'script tidak boleh kosong' },
        { status: 400 }
      );
    }

    const sshPort = parseInt(String(port)) || 22;

    // Encode password and script in base64 to avoid shell injection
    const passwordBase64 = Buffer.from(password).toString('base64');
    const scriptBase64 = Buffer.from(script).toString('base64');

    // Execute script via SSH using sshpass + pipe decoded script to bash
    const sshCmd = `echo '${passwordBase64}' | base64 -d | sshpass ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15 -p ${sshPort} ${username}@${host} 'echo ${scriptBase64} | base64 -d | bash'`;

    console.log('[VPN Routing] Applying routing script to', `${username}@${host}:${sshPort}`);

    const { stdout, stderr } = await execPromise(sshCmd, {
      timeout: 90000,      // 90s — routing scripts can take a while
      maxBuffer: 2 * 1024 * 1024,
      shell: '/bin/bash',
    });

    const output = stdout || stderr || 'Script selesai (tanpa output)';

    return NextResponse.json({
      success: true,
      message: 'Routing script berhasil diterapkan',
      output,
    });

  } catch (error: any) {
    console.error('[VPN Routing] Error:', error.message);

    const msg: string = error.message || '';

    if (msg.includes('Connection refused') || msg.includes('timed out')) {
      return NextResponse.json(
        { success: false, message: `Tidak dapat terhubung ke ${String(error.cmd || 'host')}. Periksa SSH dan firewall.` },
        { status: 500 }
      );
    }
    if (msg.includes('Permission denied') || msg.includes('Authentication failed')) {
      return NextResponse.json(
        { success: false, message: 'SSH Authentication gagal. Periksa username/password.' },
        { status: 401 }
      );
    }
    if (msg.includes('sshpass: command not found')) {
      return NextResponse.json(
        { success: false, message: 'sshpass tidak terinstall di server. Jalankan: apt-get install sshpass' },
        { status: 500 }
      );
    }

    // Return partial output plus error if available
    const partialOutput = error.stdout ? `\n--- Partial Output ---\n${error.stdout}` : '';
    return NextResponse.json(
      {
        success: false,
        message: `Script gagal: ${error.message}${partialOutput}`,
        output: error.stdout || error.stderr || '',
      },
      { status: 500 }
    );
  }
}
