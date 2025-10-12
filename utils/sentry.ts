
import { Breadcrumb, Severity, User } from '@sentry/react-native';

/**
 * Utility functions for Sentry error tracking and monitoring
 */

/**
 * Set user information for Sentry events
 * @param user User information to associate with events
 */
export const setUser = (user: {
  id?: string;
  email?: string;
  username?: string;
  role?: string;
  [key: string]: any;
}) => {
  Sentry.setUser(user);
};

/**
 * Clear user information from Sentry
 */
export const clearUser = () => {
  Sentry.setUser(null);
};

/**
 * Add a breadcrumb to track user actions
 * @param breadcrumb Breadcrumb information
 */
export const addBreadcrumb = (breadcrumb: Breadcrumb) => {
  Sentry.addBreadcrumb(breadcrumb);
};

/**
 * Track a navigation event as a breadcrumb
 * @param routeName Name of the route navigated to
 * @param params Optional route parameters
 */
export const trackNavigation = (routeName: string, params?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Navigated to ${routeName}`,
    data: params,
    level: Severity.Info,
  });
};

/**
 * Capture an exception and send to Sentry
 * @param error Error object to capture
 * @param context Additional context information
 */
export const captureException = (error: Error, context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
};

/**
 * Capture a message and send to Sentry
 * @param message Message to capture
 * @param level Severity level
 * @param context Additional context information
 */
export const captureMessage = (
  message: string,
  level: Severity = Severity.Info,
  context?: Record<string, any>
) => {
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureMessage(message);
  });
};

/**
 * Start a performance transaction
 * @param name Transaction name
 * @param operation Operation type
 * @returns Transaction object
 */
export const startTransaction = (name: string, operation: string) => {
  return Sentry.startTransaction({
    name,
    op: operation,
  });
};

/**
 * Set a tag for all future events
 * @param key Tag key
 * @param value Tag value
 */
export const setTag = (key: string, value: string) => {
  Sentry.setTag(key, value);
};

/**
 * Set context data for all future events
 * @param name Context name
 * @param context Context data
 */
export const setContext = (name: string, context: Record<string, any>) => {
  Sentry.setContext(name, context);
};

/**
 * Wrap a component with Sentry error boundary
 * @param component Component to wrap
 * @returns Wrapped component
 */
export const withErrorBoundary = <P extends object>(Component: React.ComponentType<P>) => {
  return Sentry.withErrorBoundary(Component);
};

/**
 * Create a feedback form for users to report issues
 * @param formData Initial form data
 */
export const showFeedbackForm = (formData?: {
  email?: string;
  comments?: string;
  name?: string;
}) => {
  Sentry.showReportDialog(formData);
};

export default {
  setUser,
  clearUser,
  addBreadcrumb,
  trackNavigation,
  captureException,
  captureMessage,
  startTransaction,
  setTag,
  setContext,
  withErrorBoundary,
  showFeedbackForm,
};