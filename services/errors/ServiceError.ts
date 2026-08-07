/**
 * Standardized Error Handling
 * 
 * Provides consistent error handling patterns across all services.
 * Integrates with LoggingService for logging and Sentry for error reporting.
 * 
 * @module services/errors/ServiceError
 */

import { LoggingService } from '../logging/LoggingService';
import * as Sentry from '@sentry/react-native';

/**
 * Standard error codes for categorizing errors
 */
export enum ErrorCode {
  // Authentication errors (1xxx)
  AUTH_NOT_AUTHENTICATED = 'AUTH_1001',
  AUTH_SESSION_EXPIRED = 'AUTH_1002',
  AUTH_INVALID_CREDENTIALS = 'AUTH_1003',
  AUTH_PERMISSION_DENIED = 'AUTH_1004',
  AUTH_OTP_EXPIRED = 'AUTH_1005',
  AUTH_OTP_INVALID = 'AUTH_1006',
  AUTH_RATE_LIMITED = 'AUTH_1007',
  
  // Network errors (2xxx)
  NETWORK_OFFLINE = 'NET_2001',
  NETWORK_TIMEOUT = 'NET_2002',
  NETWORK_REQUEST_FAILED = 'NET_2003',
  NETWORK_SERVER_ERROR = 'NET_2004',
  
  // Data errors (3xxx)
  DATA_NOT_FOUND = 'DATA_3001',
  DATA_VALIDATION_FAILED = 'DATA_3002',
  DATA_DUPLICATE = 'DATA_3003',
  DATA_CORRUPTED = 'DATA_3004',
  
  // Storage errors (4xxx)
  STORAGE_UPLOAD_FAILED = 'STORAGE_4001',
  STORAGE_DOWNLOAD_FAILED = 'STORAGE_4002',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_4003',
  STORAGE_FILE_NOT_FOUND = 'STORAGE_4004',
  
  // Service errors (5xxx)
  SERVICE_UNAVAILABLE = 'SVC_5001',
  SERVICE_CONFIG_MISSING = 'SVC_5002',
  SERVICE_INITIALIZATION_FAILED = 'SVC_5003',
  SERVICE_EXTERNAL_API_ERROR = 'SVC_5004',
  
  // Credit/Payment errors (6xxx)
  CREDIT_INSUFFICIENT = 'CREDIT_6001',
  CREDIT_KYC_REQUIRED = 'CREDIT_6002',
  CREDIT_LIMIT_EXCEEDED = 'CREDIT_6003',
  PAYMENT_FAILED = 'CREDIT_6004',
  
  // Permission errors (7xxx)
  PERMISSION_MICROPHONE = 'PERM_7001',
  PERMISSION_CAMERA = 'PERM_7002',
  PERMISSION_LOCATION = 'PERM_7003',
  PERMISSION_STORAGE = 'PERM_7004',
  
  // Unknown/Generic errors (9xxx)
  UNKNOWN = 'ERR_9999',
}

/**
 * Error severity levels for prioritizing error handling
 */
export enum ErrorSeverity {
  /** Low severity - informational, doesn't affect user experience */
  LOW = 'low',
  /** Medium severity - affects some functionality but app is usable */
  MEDIUM = 'medium',
  /** High severity - significantly impacts user experience */
  HIGH = 'high',
  /** Critical severity - app may be unusable */
  CRITICAL = 'critical',
}

/**
 * Interface for standardized application errors
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  originalError?: Error;
  context?: Record<string, unknown>;
  severity?: ErrorSeverity;
  timestamp?: Date;
}

/**
 * Context information for error tracking
 */
export interface ErrorContext {
  [key: string]: unknown;
  service?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
}

/**
 * Options for creating a ServiceError
 */
export interface ServiceErrorOptions {
  code: ErrorCode;
  message: string;
  userMessage?: string;
  originalError?: Error | unknown;
  context?: ErrorContext;
  severity?: ErrorSeverity;
  shouldReport?: boolean;
  shouldLog?: boolean;
}

/**
 * Standardized error class for all service errors.
 * 
 * Features:
 * - Consistent error structure across the app
 * - User-friendly messages separate from technical details
 * - Automatic logging through LoggingService
 * - Automatic Sentry reporting for high-severity errors
 * - Context preservation for debugging
 * 
 * @example
 * ```typescript
 * throw new ServiceError({
 *   code: ErrorCode.AUTH_SESSION_EXPIRED,
 *   message: 'Session token expired at timestamp 123456',
 *   userMessage: 'Your session has expired. Please log in again.',
 *   context: { userId: '123', tokenExpiry: 123456 }
 * });
 * ```
 */
export class ServiceError extends Error implements AppError {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly originalError?: Error;
  public readonly context?: ErrorContext;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;

  constructor(options: ServiceErrorOptions) {
    super(options.message);
    
    this.name = 'ServiceError';
    this.code = options.code;
    this.userMessage = options.userMessage || this.getDefaultUserMessage(options.code);
    this.severity = options.severity || this.getDefaultSeverity(options.code);
    this.timestamp = new Date();
    this.context = options.context;
    
    // Preserve original error
    if (options.originalError instanceof Error) {
      this.originalError = options.originalError;
      this.stack = `${this.stack}\nCaused by: ${options.originalError.stack}`;
    } else if (options.originalError) {
      // Handle non-Error objects
      this.context = {
        ...this.context,
        originalErrorData: options.originalError,
      };
    }

    // Log the error
    if (options.shouldLog !== false) {
      this.logError();
    }

    // Report to Sentry for high-severity errors
    if (options.shouldReport !== false && this.shouldReportToSentry()) {
      this.reportToSentry();
    }
  }

  /**
   * Get default user-friendly message based on error code
   */
  private getDefaultUserMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.AUTH_NOT_AUTHENTICATED]: 'Please log in to continue.',
      [ErrorCode.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
      [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid credentials. Please try again.',
      [ErrorCode.AUTH_PERMISSION_DENIED]: 'You don\'t have permission to perform this action.',
      [ErrorCode.AUTH_OTP_EXPIRED]: 'Verification code has expired. Please request a new one.',
      [ErrorCode.AUTH_OTP_INVALID]: 'Invalid verification code. Please check and try again.',
      [ErrorCode.AUTH_RATE_LIMITED]: 'Too many attempts. Please wait before trying again.',
      
      [ErrorCode.NETWORK_OFFLINE]: 'No internet connection. Please check your network.',
      [ErrorCode.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
      [ErrorCode.NETWORK_REQUEST_FAILED]: 'Unable to complete request. Please try again.',
      [ErrorCode.NETWORK_SERVER_ERROR]: 'Server error. Please try again later.',
      
      [ErrorCode.DATA_NOT_FOUND]: 'The requested item was not found.',
      [ErrorCode.DATA_VALIDATION_FAILED]: 'Invalid data provided. Please check your input.',
      [ErrorCode.DATA_DUPLICATE]: 'This item already exists.',
      [ErrorCode.DATA_CORRUPTED]: 'Data error. Please try again.',
      
      [ErrorCode.STORAGE_UPLOAD_FAILED]: 'Failed to upload file. Please try again.',
      [ErrorCode.STORAGE_DOWNLOAD_FAILED]: 'Failed to download file. Please try again.',
      [ErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Storage limit exceeded.',
      [ErrorCode.STORAGE_FILE_NOT_FOUND]: 'File not found.',
      
      [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
      [ErrorCode.SERVICE_CONFIG_MISSING]: 'Service configuration error. Please contact support.',
      [ErrorCode.SERVICE_INITIALIZATION_FAILED]: 'Failed to initialize service. Please restart the app.',
      [ErrorCode.SERVICE_EXTERNAL_API_ERROR]: 'External service error. Please try again.',
      
      [ErrorCode.CREDIT_INSUFFICIENT]: 'Insufficient credit available.',
      [ErrorCode.CREDIT_KYC_REQUIRED]: 'KYC verification required to proceed.',
      [ErrorCode.CREDIT_LIMIT_EXCEEDED]: 'Credit limit exceeded.',
      [ErrorCode.PAYMENT_FAILED]: 'Payment failed. Please try again.',
      
      [ErrorCode.PERMISSION_MICROPHONE]: 'Microphone permission required.',
      [ErrorCode.PERMISSION_CAMERA]: 'Camera permission required.',
      [ErrorCode.PERMISSION_LOCATION]: 'Location permission required.',
      [ErrorCode.PERMISSION_STORAGE]: 'Storage permission required.',
      
      [ErrorCode.UNKNOWN]: 'An unexpected error occurred. Please try again.',
    };
    
    return messages[code] || messages[ErrorCode.UNKNOWN];
  }

  /**
   * Get default severity based on error code
   */
  private getDefaultSeverity(code: ErrorCode): ErrorSeverity {
    // Critical errors
    if (code.startsWith('AUTH_100') || code === ErrorCode.SERVICE_INITIALIZATION_FAILED) {
      return ErrorSeverity.HIGH;
    }
    
    // High severity
    if (code.startsWith('NET_') || code.startsWith('SVC_')) {
      return ErrorSeverity.MEDIUM;
    }
    
    // Medium severity
    if (code.startsWith('DATA_') || code.startsWith('STORAGE_')) {
      return ErrorSeverity.MEDIUM;
    }
    
    // Low severity
    if (code.startsWith('PERM_')) {
      return ErrorSeverity.LOW;
    }
    
    return ErrorSeverity.MEDIUM;
  }

  /**
   * Determine if error should be reported to Sentry
   */
  private shouldReportToSentry(): boolean {
    return this.severity === ErrorSeverity.HIGH || this.severity === ErrorSeverity.CRITICAL;
  }

  /**
   * Log the error through LoggingService
   */
  private logError(): void {
    LoggingService.error(
      `[${this.code}] ${this.message}`,
      this.originalError,
      {
        code: this.code,
        severity: this.severity,
        userMessage: this.userMessage,
        ...this.context,
      }
    );
  }

  /**
   * Report error to Sentry
   */
  private reportToSentry(): void {
    Sentry.captureException(this, {
      tags: {
        errorCode: this.code,
        severity: this.severity,
      },
      extra: {
        userMessage: this.userMessage,
        ...this.context,
      },
    });
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      timestamp: this.timestamp,
      context: this.context,
    };
  }

  /**
   * Create a ServiceError from an unknown error
   */
  static fromUnknown(
    error: unknown,
    options?: Partial<ServiceErrorOptions>
  ): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    const message = error instanceof Error 
      ? error.message 
      : String(error);

    return new ServiceError({
      code: options?.code || ErrorCode.UNKNOWN,
      message,
      originalError: error instanceof Error ? error : undefined,
      ...options,
    });
  }

  /**
   * Check if an error is a ServiceError
   */
  static isServiceError(error: unknown): error is ServiceError {
    return error instanceof ServiceError;
  }

  /**
   * Check if error matches a specific code
   */
  static hasCode(error: unknown, code: ErrorCode): boolean {
    return error instanceof ServiceError && error.code === code;
  }
}
