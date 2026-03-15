import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function git(cmd: string): string {
  try {
    return execSync(cmd, { cwd: process.cwd(), timeout: 5000 }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  const localCommit  = git('git rev-parse HEAD');
  const shortCommit  = localCommit !== 'unknown' ? localCommit.slice(0, 7) : 'unknown';
  const commitDate   = git('git log -1 --format="%ci"');
  const commitMsg    = git('git log -1 --format="%s"');

  // Fetch remote commit without full pull (fast)
  let remoteCommit = 'unknown';
  let hasUpdate    = false;
  try {
    execSync('git fetch origin master --quiet', { cwd: process.cwd(), timeout: 10000 });
    remoteCommit = git('git rev-parse origin/master');
    hasUpdate    = localCommit !== 'unknown' && remoteCommit !== 'unknown' && localCommit !== remoteCommit;
  } catch { /* network unavailable */ }

  const logExists = existsSync('/tmp/salfanet-update.log');
  const pidExists = existsSync('/tmp/salfanet-update.pid');
  let updateRunning = false;
  if (pidExists) {
    try {
      const pid = parseInt(readFileSync('/tmp/salfanet-update.pid', 'utf-8').trim());
      execSync(`kill -0 ${pid}`, { timeout: 2000 });
      updateRunning = true;
    } catch { updateRunning = false; }
  }

  return NextResponse.json({
    version:       pkg.version,
    commit:        shortCommit,
    commitFull:    localCommit,
    commitDate,
    commitMessage: commitMsg,
    remoteCommit:  remoteCommit !== 'unknown' ? remoteCommit.slice(0, 7) : 'unknown',
    hasUpdate,
    updateRunning,
    logExists,
    nodeVersion:   process.version,
    platform:      process.platform,
    uptime:        Math.floor(process.uptime()),
  });
}
