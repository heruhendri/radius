module.exports = {
  apps: [
    // Main Next.js Application
    {
      name: 'salfanet-radius',
      script: '.next/standalone/server.js', // standalone output — lebih hemat memory
      cwd: process.env.APP_DIR || '/var/www/salfanet-radius',
      instances: 2,            // Gunakan kedua CPU core (2 thread)
      exec_mode: 'cluster',    // Load balance antar 2 worker
      watch: false,
      // Memory: 2 instance × 256MB = 512MB heap limit, actual ~300MB total
      max_memory_restart: '280M',
      node_args: [
        '--max-old-space-size=256',  // Per-instance heap limit
        '--max-semi-space-size=8',   // Reduce new generation size
        '--optimize-for-size',       // Optimize for memory over speed
        '--expose-gc',               // Allow explicit GC calls
      ],
      env: {
        NODE_ENV: 'production',
        // NODE_OPTIONS tidak diisi — sudah diatur via node_args di atas
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
      // Cron tidak perlu banyak memori — cukup 120MB heap
      max_memory_restart: '150M',
      node_args: [
        '--max-old-space-size=120',  // Limit heap to 120MB
        '--max-semi-space-size=4',
        '--optimize-for-size',
        '--expose-gc',
      ],
      env: {
        NODE_ENV: 'production',
        // NODE_OPTIONS tidak diisi — sudah diatur via node_args di atas
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
