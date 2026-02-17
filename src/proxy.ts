import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIsolationSettings, isIpInIsolationPool } from '@/lib/isolation-settings';

/**
 * Proxy to handle:
 * 1. Admin authentication
 * 2. Isolated user detection (auto-redirect to /isolated page)
 */
export default withAuth(
  async function proxy(req: NextRequest) {
    // First, check for isolated IP detection
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const sourceIp = forwarded?.split(',')[0]?.trim() || realIp || '';
    
    if (sourceIp) {
      try {
        // Get dynamic isolation settings from database
        const isolationSettings = await getIsolationSettings();
        
        // Check if IP is from configured isolation pool
        const isIsolatedIp = isolationSettings.isolationEnabled && 
          isIpInIsolationPool(sourceIp, isolationSettings.isolationIpPool);
        
        if (isIsolatedIp) {
          const currentPath = req.nextUrl.pathname;
          
          // Don't redirect if already on allowed pages
          const allowedPaths = [
            '/isolated',           // Isolation page
            '/pay',                // Payment pages
            '/api',                // API routes
            '/_next',              // Next.js internal
            '/favicon.ico',        // Favicon
            '/logo.png',           // Logo
            '/images',             // Images
            '/admin',              // Allow admin access
          ];
          
          const isAllowedPath = allowedPaths.some(path => currentPath.startsWith(path));
          const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(currentPath);
          
          if (!isAllowedPath && !hasFileExtension) {
            console.log(`[PROXY] Isolated IP detected: ${sourceIp} (pool: ${isolationSettings.isolationIpPool}), redirecting to /isolated`);
            
            const url = req.nextUrl.clone();
            url.pathname = '/isolated';
            url.searchParams.set('ip', sourceIp);
            
            return NextResponse.redirect(url);
          }
        }
      } catch (error) {
        console.error('[PROXY] Error checking isolation settings:', error);
        // Fallback to hardcoded check on error
        const isIsolatedIp = sourceIp.startsWith('192.168.200.');
        
        if (isIsolatedIp) {
          const currentPath = req.nextUrl.pathname;
          const allowedPaths = ['/isolated', '/pay', '/api', '/_next', '/favicon.ico', '/logo.png', '/images', '/admin'];
          const isAllowedPath = allowedPaths.some(path => currentPath.startsWith(path));
          const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(currentPath);
          
          if (!isAllowedPath && !hasFileExtension) {
            console.log(`[PROXY] Isolated IP detected (fallback): ${sourceIp}, redirecting to /isolated`);
            const url = req.nextUrl.clone();
            url.pathname = '/isolated';
            url.searchParams.set('ip', sourceIp);
            return NextResponse.redirect(url);
          }
        }
      }
    }
    
    // Continue with normal auth check for admin routes
    const response = NextResponse.next();
    
    // ==============================================
    // SECURITY HEADERS
    // ==============================================
    
    // X-Frame-Options: Prevents clickjacking attacks
    response.headers.set('X-Frame-Options', 'DENY');
    
    // X-Content-Type-Options: Prevents MIME sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    // X-XSS-Protection: Legacy XSS protection (for older browsers)
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // Referrer-Policy: Controls referrer information
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions-Policy: Controls browser features
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
    
    // Content-Security-Policy: Comprehensive protection against XSS
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.fonnte.com https://api.wablas.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests"
    ].join('; ');
    response.headers.set('Content-Security-Policy', cspDirectives);
    
    // X-DNS-Prefetch-Control: Control DNS prefetching
    response.headers.set('X-DNS-Prefetch-Control', 'off');
    
    // X-Download-Options: Prevent IE from executing downloads
    response.headers.set('X-Download-Options', 'noopen');
    
    // X-Permitted-Cross-Domain-Policies: Control Adobe Flash/PDF
    response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Remove technology disclosure headers
    response.headers.delete('X-Powered-By');
    response.headers.delete('Server');
    
    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Require auth for all /admin routes
        return !!token;
      },
    },
    pages: {
      signIn: '/admin/login',
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',  // Admin routes (auth required)
    '/((?!api|_next/static|_next/image|favicon.ico|logo.png).*)', // All other routes (for isolated IP check)
  ],
};
