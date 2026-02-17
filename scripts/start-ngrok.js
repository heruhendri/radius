#!/usr/bin/env node

/**
 * Start ngrok tunnel for mobile testing
 * Usage: npm run tunnel
 */

const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

console.log('\n🚀 Starting ngrok tunnel...');
console.log(`   Port: ${PORT}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Try to use npx ngrok
const ngrok = spawn('npx', ['ngrok', 'http', PORT.toString(), '--log=stdout'], {
  stdio: 'inherit',
  shell: true,
});

ngrok.on('error', (error) => {
  console.error('\n❌ Error starting ngrok:', error.message);
  console.error('\n💡 Installing ngrok globally might help:');
  console.error('   npm install -g ngrok\n');
  process.exit(1);
});

ngrok.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.log('\n🛑 Ngrok stopped\n');
  }
  process.exit(code || 0);
});

console.log('💡 Instructions:');
console.log('   1. Look for the "Forwarding" line above');
console.log('   2. Copy the https://xxxx.ngrok-free.app URL');
console.log('   3. Open that URL on your mobile device');
console.log('   4. Press Ctrl+C to stop the tunnel\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

