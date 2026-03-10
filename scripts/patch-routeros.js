#!/usr/bin/env node
/**
 * Patch node-routeros Channel.js to handle '!empty' reply from RouterOS v7+
 * 
 * RouterOS v7 returns '!empty' for queries with no results (e.g. /ip/hotspot/active/print
 * when no hotspot is configured). node-routeros 1.6.x doesn't handle this and throws
 * an uncaught RosException from an event handler, which crashes the process.
 * 
 * This patch adds 'case !empty:' to the processPacket switch statement, treating it
 * the same as '!done' (empty result set).
 * 
 * Run: node scripts/patch-routeros.js
 * Add to package.json postinstall: "postinstall": "node scripts/patch-routeros.js"
 */

const fs = require('fs');
const path = require('path');

const channelPath = path.join(__dirname, '..', 'node_modules', 'node-routeros', 'dist', 'Channel.js');

if (!fs.existsSync(channelPath)) {
  console.log('[patch-routeros] node-routeros not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(channelPath, 'utf8');

if (content.includes("'!empty'")) {
  console.log('[patch-routeros] Already patched');
  process.exit(0);
}

// Add case '!empty': as a no-op BEFORE the !done case.
// RouterOS v7+ sends !empty for empty results, followed by !done.
// We must NOT close the channel on !empty — just ignore it and let !done handle cleanup.
const patched = content.replace(
  "case '!done':",
  "case '!empty':\n                break;\n            case '!done':"
);

if (patched === content) {
  console.error('[patch-routeros] Could not find pattern to patch');
  process.exit(1);
}

fs.writeFileSync(channelPath, patched, 'utf8');
console.log('[patch-routeros] Successfully patched Channel.js to handle !empty reply');
