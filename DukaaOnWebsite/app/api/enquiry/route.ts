import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateInquiryForm, sanitizeInput } from '@/lib/validation';
import { InquiryData } from '@/types';
import { CacheControl } from '@/lib/cache';

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

/**
 * Check if request is rate limited
 */
function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return false;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  record.count++;
  return false;
}

// Configure route segment - no caching for POST requests
export const dynamic = 'force-dynamic';

/**
 * POST /api/enquiry
 * Submit an enquiry about a seller or general inquiry
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Check rate limit
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again later.',
        },
        { 
          status: 429,
          headers: CacheControl.rateLimit(60),
        }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate request body
    const validationResult = validateInquiryForm(body);

    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          errors: validationResult.errors,
        },
        { 
          status: 400,
          headers: CacheControl.noStore(),
        }
      );
    }

    // Sanitize inputs
    const sanitizedData: InquiryData = {
      visitorName: sanitizeInput(body.visitorName),
      email: sanitizeInput(body.email),
      phone: sanitizeInput(body.phone),
      location: sanitizeInput(body.location),
      message: sanitizeInput(body.message),
      sellerId: body.sellerId || null,
      enquiryType: body.enquiryType || 'seller',
      stakeholderType: body.stakeholderType || undefined,
    };

    // Prepare insert data - only include fields that have values
    const insertData: any = {
      visitor_name: sanitizedData.visitorName,
      visitor_email: sanitizedData.email,
      visitor_phone: sanitizedData.phone,
      visitor_location: sanitizedData.location,
      message: sanitizedData.message,
      enquiry_type: sanitizedData.enquiryType,
      status: 'new',
    };

    // Only add optional fields if they have values
    if (sanitizedData.sellerId) {
      insertData.seller_id = sanitizedData.sellerId;
    }
    
    if (sanitizedData.stakeholderType) {
      insertData.stakeholder_type = sanitizedData.stakeholderType;
    }

    // Insert into database (RLS should be disabled for development)
    const { data, error } = await supabase
      .from('enquiry_messages')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to submit enquiry. Please try again.',
        },
        { 
          status: 500,
          headers: CacheControl.noStore(),
        }
      );
    }

    // TODO: Send notification email to admin (optional - can be implemented later)
    // This could be done via a Supabase Edge Function or a service like SendGrid

    return NextResponse.json(
      {
        success: true,
        data: {
          enquiryId: data.id,
        },
      },
      { 
        status: 201,
        headers: CacheControl.noStore(),
      }
    );
  } catch (error) {
    console.error('Enquiry submission error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      },
      { 
        status: 500,
        headers: CacheControl.noStore(),
      }
    );
  }
}

/**
 * GET /api/enquiry
 * Get enquiries (for admin use - not implemented yet)
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not implemented',
    },
    { 
      status: 501,
      headers: CacheControl.noStore(),
    }
  );
}
