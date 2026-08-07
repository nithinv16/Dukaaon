/**
 * Property-Based Tests for Centralized Logging Service
 * 
 * **Feature: codebase-optimization-audit, Property 1: Production Logging Suppression**
 * **Validates: Requirements 2.1**
 * 
 * Tests that debug and info level logs are suppressed in production mode
 * while warnings and errors are still output.
 */

import * as fc from 'fast-check';
import { LoggingServiceImpl, LogLevel } from '../../services/logging/LoggingService';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Store original console methods
const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

describe('LoggingService Property Tests', () => {
  let mockConsole: {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(() => {
    // Create mock console methods
    mockConsole = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Replace console methods with mocks
    console.debug = mockConsole.debug;
    console.info = mockConsole.info;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  /**
   * **Feature: codebase-optimization-audit, Property 1: Production Logging Suppression**
   * **Validates: Requirements 2.1**
   * 
   * Property: For any log call made through the LoggingService in production mode
   * with log level set to 'error', debug and info level logs SHALL NOT be output to the console.
   */
  describe('Property 1: Production Logging Suppression', () => {
    // Arbitrary for generating random log messages
    const logMessageArb = fc.string({ minLength: 1, maxLength: 100 });
    
    // Arbitrary for generating random context objects
    const logContextArb = fc.option(
      fc.record({
        userId: fc.option(fc.uuid()),
        action: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
        timestamp: fc.option(fc.string({ minLength: 10, maxLength: 30 })),
      }),
      { nil: undefined }
    );

    it('should suppress debug logs when log level is set to warn or higher', async () => {
      await fc.assert(
        fc.asyncProperty(
          logMessageArb,
          logContextArb,
          fc.constantFrom('warn', 'error', 'none') as fc.Arbitrary<LogLevel>,
          async (message, context, level) => {
            // Create a fresh logger instance
            const logger = new LoggingServiceImpl();
            logger.setLogLevel(level);
            logger.enableProductionLogging(false);

            // Clear mocks
            mockConsole.debug.mockClear();

            // Call debug
            logger.debug(message, context);

            // Property: Debug should NOT be called when level is warn or higher
            expect(mockConsole.debug).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should suppress info logs when log level is set to warn or higher', async () => {
      await fc.assert(
        fc.asyncProperty(
          logMessageArb,
          logContextArb,
          fc.constantFrom('warn', 'error', 'none') as fc.Arbitrary<LogLevel>,
          async (message, context, level) => {
            // Create a fresh logger instance
            const logger = new LoggingServiceImpl();
            logger.setLogLevel(level);
            logger.enableProductionLogging(false);

            // Clear mocks
            mockConsole.info.mockClear();

            // Call info
            logger.info(message, context);

            // Property: Info should NOT be called when level is warn or higher
            expect(mockConsole.info).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow warn logs when log level is warn', async () => {
      await fc.assert(
        fc.asyncProperty(
          logMessageArb,
          logContextArb,
          async (message, context) => {
            // Create a fresh logger instance
            const logger = new LoggingServiceImpl();
            logger.setLogLevel('warn');
            logger.enableProductionLogging(true); // Enable to ensure warn is output

            // Clear mocks
            mockConsole.warn.mockClear();

            // Call warn
            logger.warn(message, context);

            // Property: Warn SHOULD be called when level is warn
            expect(mockConsole.warn).toHaveBeenCalled();
            
            // Property: Message should contain the original message
            const callArgs = mockConsole.warn.mock.calls[0];
            expect(callArgs[0]).toContain(message);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow error logs regardless of log level (except none)', async () => {
      await fc.assert(
        fc.asyncProperty(
          logMessageArb,
          logContextArb,
          fc.constantFrom('debug', 'info', 'warn', 'error') as fc.Arbitrary<LogLevel>,
          async (message, context, level) => {
            // Create a fresh logger instance
            const logger = new LoggingServiceImpl();
            logger.setLogLevel(level);
            logger.enableProductionLogging(true);

            // Clear mocks
            mockConsole.error.mockClear();

            // Call error
            logger.error(message, undefined, context);

            // Property: Error SHOULD be called for all levels except 'none'
            expect(mockConsole.error).toHaveBeenCalled();
            
            // Property: Message should contain the original message
            const callArgs = mockConsole.error.mock.calls[0];
            expect(callArgs[0]).toContain(message);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should suppress all logs when level is none', async () => {
      await fc.assert(
        fc.asyncProperty(
          logMessageArb,
          logContextArb,
          async (message, context) => {
            // Create a fresh logger instance
            const logger = new LoggingServiceImpl();
            logger.setLogLevel('none');
            logger.enableProductionLogging(true);

            // Clear all mocks
            mockConsole.debug.mockClear();
            mockConsole.info.mockClear();
            mockConsole.warn.mockClear();
            mockConsole.error.mockClear();

            // Call all log methods
            logger.debug(message, context);
            logger.info(message, context);
            logger.warn(message, context);
            logger.error(message, undefined, context);

            // Property: No console methods should be called when level is 'none'
            expect(mockConsole.debug).not.toHaveBeenCalled();
            expect(mockConsole.info).not.toHaveBeenCalled();
            expect(mockConsole.warn).not.toHaveBeenCalled();
            expect(mockConsole.error).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Log Level Hierarchy', () => {
    // Arbitrary for log levels in order of verbosity
    const logLevelArb = fc.constantFrom('debug', 'info', 'warn', 'error', 'none') as fc.Arbitrary<LogLevel>;
    const logMessageArb = fc.string({ minLength: 1, maxLength: 50 });

    it('should respect log level hierarchy - higher levels suppress lower levels', async () => {
      const levelPriority: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
        none: 4,
      };

      await fc.assert(
        fc.asyncProperty(
          logLevelArb,
          logMessageArb,
          async (configuredLevel, message) => {
            const logger = new LoggingServiceImpl();
            logger.setLogLevel(configuredLevel);
            logger.enableProductionLogging(true);

            // Clear all mocks
            mockConsole.debug.mockClear();
            mockConsole.info.mockClear();
            mockConsole.warn.mockClear();
            mockConsole.error.mockClear();

            // Call all log methods
            logger.debug(message);
            logger.info(message);
            logger.warn(message);
            logger.error(message);

            // Property: Only logs at or above configured level should be output
            const configuredPriority = levelPriority[configuredLevel];

            if (levelPriority['debug'] >= configuredPriority) {
              expect(mockConsole.debug).toHaveBeenCalled();
            } else {
              expect(mockConsole.debug).not.toHaveBeenCalled();
            }

            if (levelPriority['info'] >= configuredPriority) {
              expect(mockConsole.info).toHaveBeenCalled();
            } else {
              expect(mockConsole.info).not.toHaveBeenCalled();
            }

            if (levelPriority['warn'] >= configuredPriority) {
              expect(mockConsole.warn).toHaveBeenCalled();
            } else {
              expect(mockConsole.warn).not.toHaveBeenCalled();
            }

            if (levelPriority['error'] >= configuredPriority) {
              expect(mockConsole.error).toHaveBeenCalled();
            } else {
              expect(mockConsole.error).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Scoped Logger', () => {
    const scopeNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('[') && !s.includes(']'));
    const logMessageArb = fc.string({ minLength: 1, maxLength: 50 });

    it('should prefix all messages with scope name', async () => {
      await fc.assert(
        fc.asyncProperty(
          scopeNameArb,
          logMessageArb,
          async (scopeName, message) => {
            const logger = new LoggingServiceImpl();
            logger.setLogLevel('debug');
            logger.enableProductionLogging(true);

            const scopedLogger = logger.createScope(scopeName);

            // Clear mocks
            mockConsole.debug.mockClear();
            mockConsole.info.mockClear();
            mockConsole.warn.mockClear();
            mockConsole.error.mockClear();

            // Call all scoped log methods
            scopedLogger.debug(message);
            scopedLogger.info(message);
            scopedLogger.warn(message);
            scopedLogger.error(message);

            // Property: All messages should contain the scope name
            expect(mockConsole.debug.mock.calls[0][0]).toContain(`[${scopeName}]`);
            expect(mockConsole.info.mock.calls[0][0]).toContain(`[${scopeName}]`);
            expect(mockConsole.warn.mock.calls[0][0]).toContain(`[${scopeName}]`);
            expect(mockConsole.error.mock.calls[0][0]).toContain(`[${scopeName}]`);

            // Property: All messages should contain the original message
            expect(mockConsole.debug.mock.calls[0][0]).toContain(message);
            expect(mockConsole.info.mock.calls[0][0]).toContain(message);
            expect(mockConsole.warn.mock.calls[0][0]).toContain(message);
            expect(mockConsole.error.mock.calls[0][0]).toContain(message);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Handling with Sentry', () => {
    const Sentry = require('@sentry/react-native');
    const logMessageArb = fc.string({ minLength: 1, maxLength: 50 });
    const errorMessageArb = fc.string({ minLength: 1, maxLength: 50 });

    it('should report errors to Sentry when configured', async () => {
      await fc.assert(
        fc.asyncProperty(
          logMessageArb,
          errorMessageArb,
          async (message, errorMsg) => {
            const logger = new LoggingServiceImpl();
            logger.setLogLevel('error');
            logger.setSentryReporting(true);
            logger.enableProductionLogging(true);

            // Clear Sentry mocks
            Sentry.captureException.mockClear();
            Sentry.captureMessage.mockClear();

            // Create an error and log it
            const error = new Error(errorMsg);
            logger.error(message, error);

            // Property: Sentry.captureException should be called with the error
            expect(Sentry.captureException).toHaveBeenCalledWith(
              error,
              expect.objectContaining({
                extra: expect.objectContaining({
                  message,
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not report to Sentry when disabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          logMessageArb,
          errorMessageArb,
          async (message, errorMsg) => {
            const logger = new LoggingServiceImpl();
            logger.setLogLevel('error');
            logger.setSentryReporting(false);
            logger.enableProductionLogging(true);

            // Clear Sentry mocks
            Sentry.captureException.mockClear();
            Sentry.captureMessage.mockClear();

            // Create an error and log it
            const error = new Error(errorMsg);
            logger.error(message, error);

            // Property: Sentry methods should NOT be called
            expect(Sentry.captureException).not.toHaveBeenCalled();
            expect(Sentry.captureMessage).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
