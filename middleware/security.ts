import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimitMiddleware, validateApiKey, securityHeaders, corsOptions } from '../config/security';

// Apply security headers to all responses
export function securityHeadersMiddleware(request: NextRequest) {
  const response = NextResponse.next();

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply CORS headers
  const origin = request.headers.get('origin');
  if (origin && corsOptions.origin.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
    response.headers.set('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', corsOptions.maxAge.toString());
  }

  return response;
}

// Rate limiting middleware
export async function rateLimit(request: NextRequest) {
  try {
    const ip = request.ip ?? '127.0.0.1';
    await rateLimitMiddleware(request, {
      status: (code: number) => ({ json: (data: any) => ({ status: code, data }) }),
    }, () => {});
    return NextResponse.next();
  } catch (error) {
    return NextResponse.json(
      { error: 'Too many requests, please try again later.' },
      { status: 429 }
    );
  }
}

// API key validation middleware
export function apiKeyValidation(request: NextRequest) {
  try {
    validateApiKey(request, {
      status: (code: number) => ({ json: (data: any) => ({ status: code, data }) }),
    }, () => {});
    return NextResponse.next();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 }
    );
  }
}

// Request validation middleware
export function validateRequest(schema: any) {
  return async (request: NextRequest) => {
    try {
      const body = await request.json();
      await schema.parseAsync(body);
      return NextResponse.next();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error },
        { status: 400 }
      );
    }
  };
}

// Combine all security middleware
export async function securityMiddleware(request: NextRequest) {
  // Apply security headers
  const response = securityHeadersMiddleware(request);

  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request);
  if (rateLimitResponse.status !== 200) {
    return rateLimitResponse;
  }

  // Apply API key validation for protected routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiKeyResponse = apiKeyValidation(request);
    if (apiKeyResponse.status !== 200) {
      return apiKeyResponse;
    }
  }

  return response;
}

// Export middleware configuration
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 