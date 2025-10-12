import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';
import { z } from 'zod';
import crypto from 'crypto';

// Rate Limiting Configuration
export const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of points
  duration: 60, // Per 60 seconds
  blockDuration: 60 * 15, // Block for 15 minutes if exceeded
});

// Redis Configuration for Rate Limiting
export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

// API Key Configuration
export const API_KEY_HEADER = 'X-API-Key';
export const API_KEY_PREFIX = 'dk_';
export const API_KEY_LENGTH = 32;

// Encryption Configuration
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const ENCRYPTION_IV_LENGTH = 16;

// Input Validation Schemas
export const validationSchemas = {
  // User Input Validation
  userInput: z.object({
    name: z.string().min(2).max(50),
    email: z.string().email(),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
    password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
  }),

  // Product Input Validation
  productInput: z.object({
    name: z.string().min(2).max(100),
    description: z.string().min(10),
    price: z.number().positive(),
    category: z.string(),
    min_quantity: z.number().int().positive(),
    unit: z.string(),
  }),

  // Order Input Validation
  orderInput: z.object({
    items: z.array(z.object({
      product_id: z.string(),
      quantity: z.number().int().positive(),
    })),
    delivery_address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
    }),
    payment_method: z.string(),
  }),

  // Search Input Validation
  searchInput: z.object({
    query: z.string().min(1).max(100),
    filters: z.object({
      category: z.string().optional(),
      price_range: z.object({
        min: z.number().optional(),
        max: z.number().optional(),
      }).optional(),
      distance: z.number().optional(),
    }).optional(),
  }),
};

// Security Headers Configuration
export const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// CORS Configuration
export const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', API_KEY_HEADER],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// API Key Generation
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  return API_KEY_PREFIX + randomBytes.toString('base64url');
}

// Encryption Functions
export function encrypt(text: string): { encryptedData: string; iv: string } {
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
  };
}

export function decrypt(encryptedData: string, iv: string): string {
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY),
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Rate Limiting Middleware
export async function rateLimitMiddleware(req: any, res: any, next: any) {
  try {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    await rateLimiter.consume(key);
    next();
  } catch (error) {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
    });
  }
}

// API Key Validation Middleware
export function validateApiKey(req: any, res: any, next: any) {
  const apiKey = req.headers[API_KEY_HEADER.toLowerCase()];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' });
  }

  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }

  // Here you would typically validate the API key against your database
  // For now, we'll just pass through
  next();
}

// Input Validation Middleware
export function validateInput(schema: z.ZodSchema) {
  return async (req: any, res: any, next: any) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      next(error);
    }
  };
} 