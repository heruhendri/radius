import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from './prisma';
import { logActivity } from './activity-log';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Username and password are required');
        }

        // Find user
        const user = await prisma.adminUser.findUnique({
          where: { username: credentials.username },
        });

        if (!user) {
          throw new Error('Invalid username or password');
        }

        // Check if user is active
        if (!user.isActive) {
          throw new Error('Account is inactive');
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error('Invalid username or password');
        }

        // Update last login
        await prisma.adminUser.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        // Log login activity
        try {
          await logActivity({
            userId: user.id,
            username: user.username,
            userRole: user.role,
            action: 'LOGIN',
            description: `User logged in: ${user.username} (${user.role})`,
            module: 'auth',
            status: 'success',
          });
        } catch (logError) {
          console.error('Activity log error:', logError);
        }

        // Return user data (without password)
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Add user data to token on sign in
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user data to session
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 2 * 60 * 60, // 2 hours - session expires after 2 hours
    updateAge: 15 * 60, // Update session setiap 15 menit
  },
  secret: process.env.NEXTAUTH_SECRET || 'salfanet-radius-secret-change-in-production',
};

/**
 * Verify authentication from request headers
 * Used for API route protection
 * 
 * @param request - NextRequest object from API route
 * @returns User data if authenticated, null otherwise
 */
export async function verifyAuth(request: NextRequest | Request) {
  try {
    // Convert Request to NextRequest if needed
    const nextRequest = request as NextRequest;
    
    // Method 1: Check NextAuth JWT token from cookies
    const token = await getToken({ 
      req: nextRequest,
      secret: process.env.NEXTAUTH_SECRET || 'salfanet-radius-secret-change-in-production'
    });
    
    if (token && token.id && token.username && token.role) {
      // Verify user still exists and is active
      const user = await prisma.adminUser.findUnique({
        where: { id: token.id as string },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });
      
      if (!user || !user.isActive) {
        return null;
      }
      
      return {
        authenticated: true,
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    }
    
    // Method 2: Check Authorization header (for API token auth)
    const authHeader = request.headers.get('authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiToken = authHeader.substring(7);
      
      // Validate API token (if you implement API token system)
      // For now, this is a placeholder for future API token implementation
      // You can add API token validation here
      
      return null; // Not implemented yet
    }
    
    return null;
  } catch (error) {
    console.error('[AUTH] Verification error:', error);
    return null;
  }
}

/**
 * Verify and require authentication
 * Throws error if not authenticated
 */
export async function requireAuth(request: NextRequest | Request) {
  const user = await verifyAuth(request);
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

/**
 * Verify and require specific role
 * Throws error if not authenticated or insufficient role
 */
export async function requireRole(request: NextRequest | Request, allowedRoles: string[]) {
  const user = await requireAuth(request);
  
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden: Insufficient permissions');
  }
  
  return user;
}

/**
 * Check if user has admin privileges
 * SUPER_ADMIN has full access
 */
export async function requireAdmin(request: NextRequest | Request) {
  const user = await requireAuth(request);
  
  if (user.role !== 'SUPER_ADMIN') {
    throw new Error('Forbidden: Admin access required');
  }
  
  return user;
}

/**
 * Check if user has staff-level privileges or higher
 * Includes: SUPER_ADMIN, FINANCE, CUSTOMER_SERVICE, TECHNICIAN, MARKETING
 */
export async function requireStaff(request: NextRequest | Request) {
  const user = await requireAuth(request);
  
  const staffRoles = ['SUPER_ADMIN', 'FINANCE', 'CUSTOMER_SERVICE', 'TECHNICIAN', 'MARKETING'];
  
  if (!staffRoles.includes(user.role)) {
    throw new Error('Forbidden: Staff access required');
  }
  
  return user;
}
