import { NextResponse, NextRequest } from 'next/server';

import { monitoringUtils, performanceConfig, securityConfig } from '../config/monitoring';

// Performance monitoring middleware
export const performanceMiddleware = async (request: NextRequest) => {
  const startTime = Date.now();
  
  try {
    const response = await NextResponse.next();
    
    // Track response time
    const duration = Date.now() - startTime;
    monitoringUtils.trackPerformance('api_response_time', duration);
    
    // Check against thresholds
    if (duration > performanceConfig.thresholds.apiResponse.error) {
      monitoringUtils.sendAlert('high', `Slow API response: ${duration}ms for ${request.url}`);
    } else if (duration > performanceConfig.thresholds.apiResponse.warning) {
      monitoringUtils.sendAlert('medium', `Warning: API response time ${duration}ms for ${request.url}`);
    }
    
    return response;
  } catch (error) {
    // Track error and duration
    monitoringUtils.trackError(error as Error, 'api_error', 'high');
    monitoringUtils.trackPerformance('api_error_time', Date.now() - startTime);
    throw error;
  }
};

// Security monitoring middleware
export const securityMiddleware = async (request: NextRequest) => {
  // Track authentication attempts
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    monitoringUtils.trackSecurityEvent('auth_attempt', {
      path: request.nextUrl.pathname,
      method: request.method,
      ip: request.ip,
    });
  }
  
  // Track API access
  if (request.nextUrl.pathname.startsWith('/api')) {
    monitoringUtils.trackSecurityEvent('api_access', {
      path: request.nextUrl.pathname,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers.get('user-agent'),
    });
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = securityConfig.api.suspiciousPatterns;
  const requestHeaders = Object.fromEntries(request.headers.entries());
  
  if (suspiciousPatterns.some(pattern => {
    switch (pattern) {
      case 'unusual_volume':
        // Implement rate limiting check
        return false;
      case 'malformed_requests':
        return !requestHeaders['content-type'] || 
               !requestHeaders['accept'];
      case 'unauthorized_access':
        return !requestHeaders['authorization'];
      default:
        return false;
    }
  })) {
    monitoringUtils.sendAlert('high', `Suspicious request pattern detected: ${request.url}`);
  }
  
  return NextResponse.next();
};

// Analytics tracking middleware
export const analyticsMiddleware = async (request: NextRequest) => {
  // Track page views
  if (!request.nextUrl.pathname.startsWith('/api')) {
    monitoringUtils.trackEvent('page_view', {
      path: request.nextUrl.pathname,
      referrer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    });
  }
  
  // Track API usage
  if (request.nextUrl.pathname.startsWith('/api')) {
    monitoringUtils.trackEvent('api_call', {
      path: request.nextUrl.pathname,
      method: request.method,
      status: 'started',
    });
  }
  
  return NextResponse.next();
};

// Error tracking middleware
export const errorTrackingMiddleware = async (request: NextRequest) => {
  try {
    return await NextResponse.next();
  } catch (error) {
    // Track error with Sentry
    Sentry.withScope(scope => {
      scope.setExtra('url', request.url);
      scope.setExtra('method', request.method);
      scope.setExtra('headers', Object.fromEntries(request.headers.entries()));
      Sentry.captureException(error);
    });
    
    // Track error with our monitoring system
    monitoringUtils.trackError(error as Error, 'unhandled_error', 'high');
    
    // Send alert if needed
    monitoringUtils.sendAlert('critical', `Unhandled error in ${request.url}: ${(error as Error).message}`);
    
    throw error;
  }
};

// Combine all monitoring middleware
export const monitoringMiddleware = async (request: NextRequest) => {
  try {
    // Apply security monitoring first
    await securityMiddleware(request);
    
    // Apply performance monitoring
    const response = await performanceMiddleware(request);
    
    // Apply analytics tracking
    await analyticsMiddleware(request);
    
    return response;
  } catch (error) {
    // Apply error tracking
    await errorTrackingMiddleware(request);
    throw error;
  }
};

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