# Requirements Document

## Introduction

This feature simplifies the DukaaOn app loading flow by replacing the complex multi-layered caching, background revalidation, and auth synchronization system with a straightforward AsyncStorage-based approach. The current implementation has become overly complex with multiple safety timeouts, race conditions, and competing services that cause the app to hang on first launch but work on subsequent opens.

## Glossary

- **App_Loading_System**: The system responsible for determining user authentication state and navigating to the appropriate screen on app launch
- **AsyncStorage**: React Native's persistent key-value storage system for storing user data locally
- **Auth_State**: The current authentication status including user profile, session validity, and role
- **Splash_Screen**: The initial loading screen shown while the app determines where to navigate
- **Profile_Data**: User information including id, phone_number, role, business_details, and seller_details

## Requirements

### Requirement 1

**User Story:** As a user, I want the app to load quickly using cached data, so that I can start using the app without waiting for network requests.

#### Acceptance Criteria

1. WHEN the app launches THE App_Loading_System SHALL check AsyncStorage for cached auth data within 100ms
2. WHEN cached auth data exists THE App_Loading_System SHALL navigate to the main screen immediately without waiting for network validation
3. WHEN no cached auth data exists THE App_Loading_System SHALL navigate to the language/login screen within 500ms
4. WHEN the app loads THE App_Loading_System SHALL display the splash screen for no longer than 2 seconds under normal conditions

### Requirement 2

**User Story:** As a user, I want my profile data to be available immediately from cache, so that the home screen can render without loading states.

#### Acceptance Criteria

1. WHEN navigating to the home screen THE App_Loading_System SHALL provide cached profile data to components synchronously
2. WHEN profile data is cached THE App_Loading_System SHALL make the data available before home screen components mount
3. WHEN profile data changes THE App_Loading_System SHALL update AsyncStorage within 1 second of the change

### Requirement 3

**User Story:** As a user, I want background session validation to happen silently, so that my app experience is not interrupted by auth checks.

#### Acceptance Criteria

1. WHEN the user is already navigated to the main screen THE App_Loading_System SHALL perform session validation in the background
2. WHEN background validation fails THE App_Loading_System SHALL only log out the user if the session is definitively invalid (not just a network error)
3. WHEN background validation succeeds THE App_Loading_System SHALL silently update the session without UI interruption

### Requirement 4

**User Story:** As a developer, I want a simple, linear auth flow, so that the codebase is maintainable and debugging is straightforward.

#### Acceptance Criteria

1. THE App_Loading_System SHALL use a single entry point for auth initialization
2. THE App_Loading_System SHALL avoid race conditions by using sequential async/await patterns
3. THE App_Loading_System SHALL remove all safety timeout mechanisms that exceed 3 seconds
4. THE App_Loading_System SHALL consolidate auth logic into a single service file

### Requirement 5

**User Story:** As a user, I want the app to work reliably on first launch, so that I don't need to close and reopen the app.

#### Acceptance Criteria

1. WHEN the app launches for the first time after install THE App_Loading_System SHALL navigate to the language screen within 1 second
2. WHEN the app launches with valid cached auth THE App_Loading_System SHALL navigate to the main screen within 1 second
3. WHEN any error occurs during loading THE App_Loading_System SHALL fall back to the language screen rather than showing a loading spinner indefinitely
