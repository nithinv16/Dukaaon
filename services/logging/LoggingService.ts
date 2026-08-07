/**
 * Centralized Logging Service
 * 
 * Environment-aware logging that suppresses debug/info logs in production.
 * Integrates with Sentry for error reporting.
 * 
 * @module services/logging/LoggingService
 */

import * as Sentry from '@sentry/react-native';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

interface LoggingConfig {
  level: LogLevel;
  enableInProduction: boolean;
  reportToSentry: boolean;
}

interface LogContext {
  [key: string]: unknown;
}

// Log level priority (lower = more verbose)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

/**
 * Centralized logging service with environment-aware filtering.
 * 
 * In production mode (when __DEV__ is false), debug and info logs are suppressed.
 * Errors are always reported to Sentry when configured.
 */
class LoggingServiceImpl {
  private config: LoggingConfig;
  private isProduction: boolean;

  constructor() {
    // Detect production mode using React Native's __DEV__ flag
    this.isProduction = typeof __DEV__ !== 'undefined' ? !__DEV__ : true;
    
    this.config = {
      // In production, only show warnings and errors
      level: this.isProduction ? 'warn' : 'debug',
      enableInProduction: false,
      reportToSentry: true,
    };
  }

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Get the current log level
   */
  getLogLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    // In production, suppress debug and info unless explicitly enabled
    if (this.isProduction && !this.config.enableInProduction) {
      if (level === 'debug' || level === 'info') {
        return false;
      }
    }
    
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  /**
   * Format log message with optional context
   */
  private formatMessage(message: string, context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) {
      return message;
    }
    return `${message} ${JSON.stringify(context)}`;
  }

  /**
   * Log debug message (suppressed in production)
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    
    if (context) {
      console.debug(`[DEBUG] ${message}`, context);
    } else {
      console.debug(`[DEBUG] ${message}`);
    }
  }

  /**
   * Log info message (suppressed in production)
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    
    if (context) {
      console.info(`[INFO] ${message}`, context);
    } else {
      console.info(`[INFO] ${message}`);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    
    if (context) {
      console.warn(`[WARN] ${message}`, context);
    } else {
      console.warn(`[WARN] ${message}`);
    }
    
    // Add breadcrumb to Sentry for warnings
    if (this.config.reportToSentry) {
      Sentry.addBreadcrumb({
        category: 'warning',
        message: this.formatMessage(message, context),
        level: 'warning',
      });
    }
  }

  /**
   * Log error message and optionally report to Sentry
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return;
    
    const errorObj = error instanceof Error ? error : undefined;
    const errorContext = {
      ...context,
      ...(error && !(error instanceof Error) ? { errorData: error } : {}),
    };
    
    if (errorObj) {
      console.error(`[ERROR] ${message}`, errorObj, errorContext);
    } else if (Object.keys(errorContext).length > 0) {
      console.error(`[ERROR] ${message}`, errorContext);
    } else {
      console.error(`[ERROR] ${message}`);
    }
    
    // Report to Sentry
    if (this.config.reportToSentry) {
      if (errorObj) {
        Sentry.captureException(errorObj, {
          extra: {
            message,
            ...errorContext,
          },
        });
      } else {
        Sentry.captureMessage(message, {
          level: 'error',
          extra: errorContext,
        });
      }
    }
  }

  /**
   * Create a scoped logger with a prefix
   */
  createScope(scope: string): ScopedLogger {
    return new ScopedLogger(this, scope);
  }

  /**
   * Enable or disable Sentry reporting
   */
  setSentryReporting(enabled: boolean): void {
    this.config.reportToSentry = enabled;
  }

  /**
   * Enable logging in production (use with caution)
   */
  enableProductionLogging(enabled: boolean): void {
    this.config.enableInProduction = enabled;
  }

  /**
   * Check if running in production mode
   */
  isProductionMode(): boolean {
    return this.isProduction;
  }
}

/**
 * Scoped logger that prefixes all messages with a scope name
 */
class ScopedLogger {
  private logger: LoggingServiceImpl;
  private scope: string;

  constructor(logger: LoggingServiceImpl, scope: string) {
    this.logger = logger;
    this.scope = scope;
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(`[${this.scope}] ${message}`, context);
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(`[${this.scope}] ${message}`, context);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(`[${this.scope}] ${message}`, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.logger.error(`[${this.scope}] ${message}`, error, context);
  }
}

// Export singleton instance
export const LoggingService = new LoggingServiceImpl();

// Export types for testing
export type { LoggingConfig, LogContext, ScopedLogger };
export { LoggingServiceImpl };
