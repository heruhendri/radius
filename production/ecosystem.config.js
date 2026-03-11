module.exports = {
  apps: [
    // Main Next.js Application
    {
      name: 'salfanet-radius',
      script: '.next/standalone/server.js', // standalone output — lebih hemat memory
      cwd: process.env.APP_DIR || '/var/www/salfanet-radius',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      // Memory optimizations for 2GB VPS
      max_memory_restart: '400M',
      node_args: [
        '--max-old-space-size=350',  // Limit V8 heap to 350MB
        '--max-semi-space-size=8',   // Reduce new generation size
        '--optimize-for-size',       // Optimize for memory over speed
      ],
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=350',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',         // Required for standalone server
        TZ: 'Asia/Jakarta'
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Restart every 6 hours to clear memory leaks
      cron_restart: '0 */6 * * *'
    },
    // Standalone Cron Service
    {
      name: 'salfanet-cron',
      script: './cron-service.js',
      cwd: process.env.APP_DIR || '/var/www/salfanet-radius',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      // Memory optimizations
      max_memory_restart: '150M', // Reduced from 256M
      node_args: [
        '--max-old-space-size=120',  // Limit heap to 120MB
        '--max-semi-space-size=4',
        '--optimize-for-size',
      ],
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=120',
        API_URL: 'http://localhost:3000',
        TZ: 'Asia/Jakarta'
      },
      error_file: './logs/cron-error.log',
      out_file: './logs/cron-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      // Restart every 4 hours to prevent memory buildup
      cron_restart: '0 */4 * * *'
    }
  ]
};
