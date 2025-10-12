import { NextResponse, NextRequest } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { z } from 'zod';
import { RateLimiter } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';

// JWT secret key - should be moved to environment variables
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

// User role enum
export enum UserRole {
  CUSTOMER = 'customer',
  SELLER = 'seller',
  ADMIN = 'admin',
}

// User schema for JWT payload
const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  iat: z.number(),
  exp: z.number(),
});

// Protected routes configuration
const protectedRoutes = {
  [UserRole.CUSTOMER]: [
    '/api/orders',
    '/api/cart',
    '/api/profile',
  ],
  [UserRole.SELLER]: [
    '/api/products',
    '/api/orders',
    '/api/analytics',
  ],
  [UserRole.ADMIN]: [
    '/api/admin',
    '/api/users',
    '/api/settings',
  ],
};

// Rate limiter configuration
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const rateLimiter = new RateLimiter({
  storeClient: redis,
  keyPrefix: 'middleware',
  points: parseInt(process.env.RATE_LIMIT_POINTS || '5'),
  duration: parseInt(process.env.RATE_LIMIT_DURATION || '3600'),
});

// Verify JWT token
async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return userSchema.parse(payload);
  } catch (error) {
    return null;
  }
}

// Check if route requires authentication
function requiresAuth(pathname: string): boolean {
  return Object.values(protectedRoutes)
    .flat()
    .some(route => pathname.startsWith(route));
}

// Check if user has access to route
function hasAccess(pathname: string, userRole: UserRole): boolean {
  return protectedRoutes[userRole].some(route => pathname.startsWith(route));
}

// Rate limiting middleware
async function rateLimitMiddleware(request: NextRequest) {
  try {
    const ip = request.ip || '127.0.0.1';
    await rateLimiter.consume(ip);
    return null;
  } catch (error) {
    return NextResponse.json(
      { error: 'Too many requests, please try again later.' },
      { status: 429 }
    );
  }
}

// Authentication middleware
export async function authMiddleware(request: NextRequest) {
  // Apply rate limiting first
  const rateLimitResult = await rateLimitMiddleware(request);
  if (rateLimitResult) return rateLimitResult;

  const pathname = request.nextUrl.pathname;

  // Skip auth for public routes
  if (!requiresAuth(pathname)) {
    return NextResponse.next();
  }

  // Get token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.split(' ')[1];
  const user = await verifyToken(token);

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // Check route access
  if (!hasAccess(pathname, user.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  // Add user info to request headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.id);
  requestHeaders.set('x-user-role', user.role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Role-based access control middleware
export function requireRole(roles: UserRole[]) {
  return async (request: NextRequest) => {
    const userRole = request.headers.get('x-user-role') as UserRole;
    
    if (!userRole || !roles.includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.next();
  };
}

// Export middleware configuration
export const config = {
  matcher: [
    '/api/:path*',
  ],
}; 