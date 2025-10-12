import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

// Custom error classes
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(401, message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string) {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(429, message);
  }
}

// Error response format
interface ErrorResponse {
  error: {
    message: string;
    code: string;
    details?: any;
  };
}

// Error handler middleware
export async function errorHandler(
  request: NextRequest,
  error: Error
): Promise<NextResponse<ErrorResponse>> {
  // Log error
  logger.error({
    message: error.message,
    stack: error.stack,
    path: request.nextUrl.pathname,
    method: request.method,
    headers: Object.fromEntries(request.headers),
  });

  // Handle known errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.constructor.name,
        },
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          message: 'Validation failed',
          code: 'ValidationError',
          details: error.errors,
        },
      },
      { status: 400 }
    );
  }

  // Handle unknown errors
  return NextResponse.json(
    {
      error: {
        message: 'Internal server error',
        code: 'InternalServerError',
      },
    },
    { status: 500 }
  );
}

// Request logging middleware
export async function requestLogger(request: NextRequest) {
  const start = Date.now();

  // Log request
  logger.info({
    message: 'Incoming request',
    path: request.nextUrl.pathname,
    method: request.method,
    query: Object.fromEntries(request.nextUrl.searchParams),
    headers: Object.fromEntries(request.headers),
  });

  // Process request
  const response = await NextResponse.next();

  // Log response
  const duration = Date.now() - start;
  logger.info({
    message: 'Request completed',
    path: request.nextUrl.pathname,
    method: request.method,
    status: response.status,
    duration,
  });

  return response;
}

// Error boundary middleware
export async function errorBoundary(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  try {
    return await handler(request);
  } catch (error) {
    return errorHandler(request, error as Error);
  }
}

// Export middleware configuration
export const config = {
  matcher: [
    '/api/:path*',
  ],
}; 