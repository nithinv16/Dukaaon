import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { securityMiddleware } from './security';
import { authMiddleware } from './auth';
import { validateBody, validateQuery, validatePath } from './validation';
import { errorBoundary, requestLogger } from './error';
import { logger } from '../utils/logger';

// Middleware configuration
export const config = {
  matcher: [
    '/api/:path*',
  ],
};

// Main middleware function
export async function middleware(request: NextRequest) {
  try {
    // Log request
    await requestLogger(request);

    // Apply security middleware
    const securityResponse = await securityMiddleware(request);
    if (securityResponse.status !== 200) {
      return securityResponse;
    }

    // Apply authentication middleware
    const authResponse = await authMiddleware(request);
    if (authResponse.status !== 200) {
      return authResponse;
    }

    // Apply validation middleware based on request method
    const method = request.method;
    const pathname = request.nextUrl.pathname;

    // Validate request body for POST, PUT, PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const bodySchema = getBodySchema(pathname);
      if (bodySchema) {
        const bodyResponse = await validateBody(bodySchema)(request);
        if (bodyResponse.status !== 200) {
          return bodyResponse;
        }
      }
    }

    // Validate query parameters
    const querySchema = getQuerySchema(pathname);
    if (querySchema) {
      const queryResponse = await validateQuery(querySchema)(request);
      if (queryResponse.status !== 200) {
        return queryResponse;
      }
    }

    // Validate path parameters
    const pathSchema = getPathSchema(pathname);
    if (pathSchema) {
      const pathResponse = await validatePath(pathSchema)(request);
      if (pathResponse.status !== 200) {
        return pathResponse;
      }
    }

    // Process request
    return NextResponse.next();
  } catch (error) {
    logger.error('Middleware error:', error);
    return errorBoundary(request, async () => {
      throw error;
    });
  }
}

// Helper function to get body schema based on pathname
function getBodySchema(pathname: string) {
  // Import schemas from validation middleware
  const { productSchema, orderSchema } = require('./validation');

  // Map pathnames to schemas
  const schemaMap: Record<string, any> = {
    '/api/products': productSchema,
    '/api/orders': orderSchema,
    // Add more mappings as needed
  };

  // Find matching schema
  for (const [path, schema] of Object.entries(schemaMap)) {
    if (pathname.startsWith(path)) {
      return schema;
    }
  }

  return null;
}

// Helper function to get query schema based on pathname
function getQuerySchema(pathname: string) {
  // Import schemas from validation middleware
  const { searchSchema } = require('./validation');

  // Map pathnames to schemas
  const schemaMap: Record<string, any> = {
    '/api/search': searchSchema,
    // Add more mappings as needed
  };

  // Find matching schema
  for (const [path, schema] of Object.entries(schemaMap)) {
    if (pathname.startsWith(path)) {
      return schema;
    }
  }

  return null;
}

// Helper function to get path schema based on pathname
function getPathSchema(pathname: string) {
  // Import schemas from validation middleware
  const { commonSchemas } = require('./validation');

  // Map pathnames to schemas
  const schemaMap: Record<string, any> = {
    '/api/products/:id': commonSchemas.id,
    '/api/orders/:id': commonSchemas.id,
    // Add more mappings as needed
  };

  // Find matching schema
  for (const [path, schema] of Object.entries(schemaMap)) {
    if (pathname.match(new RegExp(path.replace(':id', '[^/]+')))) {
      return schema;
    }
  }

  return null;
} 