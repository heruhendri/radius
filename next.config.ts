import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    // ⚠️ PRODUCTION: Set to false for strict type checking
    // Currently true to allow build despite minor type issues in dependencies
    ignoreBuildErrors: false,
  },
  // Optimize for low-resource VPS (2GB RAM)
  experimental: {
    // Reduce memory usage during build
    workerThreads: false,
    cpus: 1, // Use single CPU for build to reduce memory
  },
  // Fix workspace root detection issue
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Security & Performance
  productionBrowserSourceMaps: false, // Protect code & save memory
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      },
    ];
  },
};

export default nextConfig;
