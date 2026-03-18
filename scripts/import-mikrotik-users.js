#!/usr/bin/env node
/**
 * One-time import script: fetch PPPoE secrets from MikroTik and sync to RADIUS
 * 
 * Usage: node scripts/import-mikrotik-users.js [routerId] [--dry-run]
 * 
 * Options:
 *   routerId   - NAS router ID from DB (if omitted, uses dstpaska / 10.20.30.12)
 *   --dry-run  - Preview only, do not insert
 *
 * Runs on VPS: node /var/www/salfanet-radius/scripts/import-mikrotik-users.js
 */

'use strict';

const { RouterOSAPI } = require('node-routeros');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function getRouterInfo(routerId) {
  if (!routerId) {
    // Default: use dstpaska router
    return await prisma.router.findFirst({
      where: {
        OR: [
          { shortname: 'dstpaska' },
          { nasname: '10.20.30.12' },
        ],
      },
    });
  }
  return await prisma.router.findUnique({ where: { id: routerId } });
}

async function getFirstProfile() {
  return await prisma.pppoeProfile.findFirst({
    where: { name: { not: 'isolir' } },
    orderBy: { createdAt: 'asc' },
  });
}

async function generateReferralCode() {
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const existing = await prisma.pppoeUser.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

async function main() {
  const routerId = process.argv[2] && !process.argv[2].startsWith('--')
    ? process.argv[2]
    : null;

  console.log(`[IMPORT] DRY_RUN=${DRY_RUN}`);

  const router = await getRouterInfo(routerId);
  if (!router) {
    console.error('[IMPORT] Router not found');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`[IMPORT] Router: ${router.name} (${router.nasname})`);

  const profile = await getFirstProfile();
  if (!profile) {
    console.error('[IMPORT] No pppoe_profiles found');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`[IMPORT] Default profile: ${profile.name} (${profile.groupName})`);

  // Connect to MikroTik API â€” try plaintext port first, then SSL fallback
  const apiHost = router.ipAddress || router.nasname;
  const apiPortPlain = router.port || 8728;
  const apiPortSsl = router.apiPort || 8729;
  console.log(`[IMPORT] Connecting to MikroTik ${apiHost}:${apiPortPlain}...`);

  let api;
  try {
    api = new RouterOSAPI({
      host: apiHost,
      port: apiPortPlain,
      user: router.username,
      password: router.password,
      timeout: 10,
    });
    await api.connect();
    console.log(`[IMPORT] Connected via plaintext API port ${apiPortPlain}`);
  } catch (err1) {
    console.log(`[IMPORT] Port ${apiPortPlain} failed (${err1.message}), trying SSL port ${apiPortSsl}...`);
    api = new RouterOSAPI({
      host: apiHost,
      port: apiPortSsl,
      user: router.username,
      password: router.password,
      timeout: 15,
      tls: { rejectUnauthorized: false },
    });
    await api.connect();
    console.log(`[IMPORT] Connected via SSL API port ${apiPortSsl}`);
  }

  const secrets = await api.write('/ppp/secret/print');
  await api.close();
  console.log(`[IMPORT] Fetched ${secrets.length} PPPoE secrets`);

  let imported = 0, skipped = 0, failed = 0;
  const expiredAt = new Date();
  expiredAt.setMonth(expiredAt.getMonth() + 1);
  expiredAt.setHours(23, 59, 59, 999);

  for (const secret of secrets) {
    const username = secret.name;
    const password = secret.password;

    if (!username || !password) {
      console.log(`[IMPORT] Skip ${username} - missing username or password`);
      skipped++;
      continue;
    }

    if (secret.disabled === 'true') {
      console.log(`[IMPORT] Skip ${username} - disabled in MikroTik`);
      skipped++;
      continue;
    }

    try {
      // Check if already in radcheck
      const existRadcheck = await prisma.radcheck.findFirst({
        where: { username, attribute: 'Cleartext-Password' },
        select: { id: true },
      });

      // Check if already in pppoe_users
      const existUser = await prisma.pppoeUser.findUnique({
        where: { username },
        select: { id: true },
      });

      if (existRadcheck && existUser) {
        console.log(`[IMPORT] Skip ${username} - already in DB and radcheck`);
        skipped++;
        continue;
      }

      console.log(`[IMPORT] Importing ${username}...`);

      if (!DRY_RUN) {
        // Create pppoe_user if not exists
        if (!existUser) {
          const userId = crypto.randomUUID();
          const referralCode = await generateReferralCode();
          await prisma.pppoeUser.create({
            data: {
              id: userId,
              username,
              password,
              profileId: profile.id,
              routerId: router.id,
              name: secret.comment || username,
              phone: '08',
              status: 'active',
              expiredAt,
              subscriptionType: 'POSTPAID',
              billingDay: 1,
              syncedToRadius: true,
              referralCode,
            },
          });
        }

        // Add to radcheck if not exists
        if (!existRadcheck) {
          await prisma.radcheck.create({
            data: { username, attribute: 'Cleartext-Password', op: ':=', value: password },
          });
          // NAS-IP-Address constraint
          await prisma.radcheck.create({
            data: { username, attribute: 'NAS-IP-Address', op: '==', value: router.nasname },
          });
        }

        // Add to radusergroup if not exists
        const existGroup = await prisma.radusergroup.findFirst({
          where: { username },
          select: { id: true },
        });
        if (!existGroup) {
          await prisma.radusergroup.create({
            data: { username, groupname: profile.groupName, priority: 0 },
          });
        }

        // If static IP, add radreply
        if (secret['remote-address']) {
          const existReply = await prisma.radreply.findFirst({
            where: { username, attribute: 'Framed-IP-Address' },
            select: { id: true },
          });
          if (!existReply) {
            await prisma.radreply.create({
              data: { username, attribute: 'Framed-IP-Address', op: ':=', value: secret['remote-address'] },
            });
          }
        }
      }

      imported++;
      console.log(`[IMPORT] OK ${username} (mk-profile: ${secret.profile || 'n/a'})${DRY_RUN ? ' [DRY RUN]' : ''}`);
    } catch (err) {
      console.error(`[IMPORT] FAIL ${username}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`[IMPORT] DONE: imported=${imported}, skipped=${skipped}, failed=${failed}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('[IMPORT] Fatal error:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
