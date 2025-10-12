# Error Logging with Sentry

This document provides guidelines on how to use Sentry for error logging and monitoring in the Dukaaon application.

## Overview

Sentry is integrated into our application to provide real-time error tracking and monitoring. It helps us identify, triage, and resolve issues quickly by providing detailed error reports, stack traces, and context information.

## Setup

Sentry is already configured in the application with the following components:

1. **Global initialization** in `global-setup.js` for early error capturing
2. **React Native integration** in `app/_layout.tsx` for React component errors
3. **Error boundary** in `components/ErrorBoundary.tsx` for catching and reporting UI errors
4. **Logger integration** in `utils/logger.ts` for capturing logged errors
5. **Utility functions** in `utils/sentry.ts` for easy error reporting

## How to Use

### Reporting Errors

Use the utility functions from `utils/sentry.ts` to report errors:

```typescript
import { captureException, captureMessage } from '../utils/sentry';

try {
  // Your code here
} catch (error) {
  captureException(error, { 
    component: 'YourComponent',
    action: 'whatUserWasDoing' 
  });
}

// Report a message with a specific severity level
captureMessage('Something important happened', Severity.Warning, {
  context: 'additional information'
});
```

### Tracking User Actions

Add breadcrumbs to track user actions leading up to an error:

```typescript
import { addBreadcrumb, trackNavigation } from '../utils/sentry';

// Track navigation events
trackNavigation('ProductScreen', { productId: '123' });

// Add custom breadcrumbs
addBreadcrumb({
  category: 'user-action',
  message: 'User clicked checkout button',
  level: Severity.Info
});
```

### User Identification

Associate errors with specific users:

```typescript
import { setUser, clearUser } from '../utils/sentry';

// When user logs in
setUser({
  id: user.id,
  email: user.email,
  username: user.username,
  role: user.role
});

// When user logs out
clearUser();
```

### Performance Monitoring

Track performance of critical operations:

```typescript
import { startTransaction } from '../utils/sentry';

const transaction = startTransaction('checkout', 'payment-processing');

try {
  // Perform payment processing
  // ...
  transaction.finish();
} catch (error) {
  transaction.finish();
  captureException(error);
}
```

### Adding Context

Add additional context to help with debugging:

```typescript
import { setTag, setContext } from '../utils/sentry';

// Set tags for filtering in the Sentry dashboard
setTag('environment', 'production');
setTag('version', '1.0.0');

// Add detailed context
setContext('device', {
  model: deviceInfo.model,
  os: deviceInfo.os,
  battery: deviceInfo.batteryLevel
});
```

## Error Boundary

The application includes an ErrorBoundary component that catches and reports React rendering errors. Wrap components with this boundary to prevent the entire app from crashing:

```tsx
import { ErrorBoundary } from '../components/ErrorBoundary';

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

## Best Practices

1. **Be selective**: Don't report every minor issue. Focus on critical errors that affect user experience.

2. **Add context**: Always include relevant context with errors to make debugging easier.

3. **Protect user privacy**: Don't include sensitive user information in error reports.

4. **Use breadcrumbs**: Add breadcrumbs to track user actions leading up to an error.

5. **Handle expected errors gracefully**: Don't report expected errors like network timeouts as exceptions.

6. **Group related errors**: Use tags and fingerprinting to group related errors in the Sentry dashboard.

## Viewing Error Reports

Error reports can be viewed in the Sentry dashboard at https://sentry.io/. Contact the development team for access credentials.

## Environment Variables

The following environment variables are used for Sentry configuration:

- `SENTRY_DSN`: The Data Source Name for your Sentry project
- `SENTRY_ALLOW_FAILURE`: Set to `true` to prevent Sentry upload failures from breaking builds
- `SENTRY_DISABLE_AUTO_UPLOAD`: Set to `true` to disable automatic source map uploads during builds

## Troubleshooting

If you encounter issues with Sentry integration:

1. Check that Sentry is properly initialized in `global-setup.js` and `app/_layout.tsx`
2. Verify that the correct DSN is being used
3. Check network connectivity to sentry.io
4. Review the Sentry dashboard for any issues with source map uploads