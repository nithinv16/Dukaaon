import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Common validation schemas
export const commonSchemas = {
  id: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  date: z.string().datetime(),
};

// Product validation schema
export const productSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(10).max(1000),
  price: commonSchemas.price,
  category_id: commonSchemas.id,
  seller_id: commonSchemas.id,
  min_quantity: commonSchemas.quantity,
  stock: commonSchemas.quantity,
  images: z.array(z.string().url()),
  specifications: z.record(z.string()),
});

// Order validation schema
export const orderSchema = z.object({
  items: z.array(z.object({
    product_id: commonSchemas.id,
    quantity: commonSchemas.quantity,
  })),
  shipping_address: z.object({
    street: z.string().min(5),
    city: z.string().min(2),
    state: z.string().min(2),
    country: z.string().min(2),
    postal_code: z.string().min(5),
  }),
  payment_method: z.enum(['credit_card', 'debit_card', 'upi', 'net_banking']),
});

// Search validation schema
export const searchSchema = z.object({
  query: z.string().min(2).max(100),
  category_id: commonSchemas.id.optional(),
  min_price: commonSchemas.price.optional(),
  max_price: commonSchemas.price.optional(),
  sort_by: z.enum(['price', 'name', 'rating', 'date']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

// Sanitize input data
function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    return DOMPurify.sanitize(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeInput(item));
  }
  if (typeof data === 'object' && data !== null) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, sanitizeInput(value)])
    );
  }
  return data;
}

// Validate request body
export function validateBody(schema: z.ZodSchema) {
  return async (request: NextRequest) => {
    try {
      const body = await request.json();
      const sanitizedBody = sanitizeInput(body);
      const validatedData = await schema.parseAsync(sanitizedBody);
      
      // Replace request body with validated data
      const newRequest = new NextRequest(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(validatedData),
      });

      return NextResponse.next({
        request: newRequest,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }
  };
}

// Validate query parameters
export function validateQuery(schema: z.ZodSchema) {
  return async (request: NextRequest) => {
    try {
      const searchParams = Object.fromEntries(request.nextUrl.searchParams);
      const sanitizedParams = sanitizeInput(searchParams);
      const validatedData = await schema.parseAsync(sanitizedParams);
      
      // Create new URL with validated query parameters
      const newUrl = new URL(request.url);
      Object.entries(validatedData).forEach(([key, value]) => {
        newUrl.searchParams.set(key, String(value));
      });

      const newRequest = new NextRequest(newUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      return NextResponse.next({
        request: newRequest,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid query parameters', details: error.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }
  };
}

// Validate path parameters
export function validatePath(schema: z.ZodSchema) {
  return async (request: NextRequest) => {
    try {
      const pathname = request.nextUrl.pathname;
      const pathParams = pathname.match(/\/api\/[^/]+\/([^/]+)/)?.[1];
      
      if (!pathParams) {
        return NextResponse.next();
      }

      const sanitizedParams = sanitizeInput(pathParams);
      const validatedData = await schema.parseAsync(sanitizedParams);
      
      // Create new URL with validated path parameters
      const newUrl = new URL(request.url);
      newUrl.pathname = newUrl.pathname.replace(/\/[^/]+$/, `/${validatedData}`);

      const newRequest = new NextRequest(newUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      return NextResponse.next({
        request: newRequest,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid path parameters', details: error.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid path parameters' },
        { status: 400 }
      );
    }
  };
}

// Export middleware configuration
export const config = {
  matcher: [
    '/api/:path*',
  ],
}; 