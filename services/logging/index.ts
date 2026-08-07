/**
 * Logging Service Module
 * 
 * Centralized logging with environment-aware filtering and Sentry integration.
 * 
 * Usage:
 * ```typescript
 * import { LoggingService } from '@/services/logging';
 * 
 * // Basic logging
 * LoggingService.debug('Debug message');
 * LoggingService.info('Info message', { userId: '123' });
 * LoggingService.warn('Warning message');
 * LoggingService.error('Error message', error, { context: 'value' });
 * 
 * // Scoped logging
 * const logger = LoggingService.createScope('AuthService');
 * logger.info('User logged in');
 * ```
 */

export { 
  LoggingService, 
  LoggingServiceImpl,
  type LogLevel, 
  type LogContext, 
  type ScopedLogger 
} from './LoggingService';
