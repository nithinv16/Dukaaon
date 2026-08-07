# Requirements Document

## Introduction

This document specifies the requirements for fixing the stale cache data fetching issue in the DukaaOn mobile app. Currently, when users open the app after the profile cache has become stale (but not expired), the profile loads successfully but the actual data components (products, categories, nearby wholesalers, nearby manufacturers) remain in a perpetual loading state. The user must close and reopen the app to trigger proper data fetching. The root cause is that background revalidation is not properly triggering data fetches when stale cached data is used.

## Glossary

- **Profile Cache**: AsyncStorage-based cache that stores user profile data with expiry timestamps
- **Data Fetch Coordinator**: Service that orchestrates parallel fetching of all home screen data when profile loads
- **Component-Level Cache**: AsyncStorage-based cache for individual component data (products, categories, etc.)
- **Data Components**: Home screen components that display products, categories, wholesalers, and manufacturers
- **DynamicHomeSections**: Component that orchestrates loading of dynamic home screen content
- **ProfileLoader**: Service that manages profile cache and loading from database
- **Auth Store**: Zustand store that holds user authentication state and triggers data fetches on user state changes

## Requirements

### Requirement 1

**User Story:** As a user, I want data components to load properly when I open the app, so that I don't have to restart the app to see content.

#### Acceptance Criteria

1. WHEN the ProfileLoader completes loading a profile from any source THEN the System SHALL immediately trigger data fetching for all home screen components
2. WHEN the profile is loaded from cache THEN the System SHALL fetch products, categories, wholesalers, and manufacturers from the database within 100ms
3. WHEN the profile is loaded from database THEN the System SHALL fetch dependent data in parallel with profile loading
4. WHEN data fetching completes THEN the System SHALL update component states from loading to displaying content
5. IF data fetching fails THEN the System SHALL retry with exponential backoff up to 3 attempts

### Requirement 2

**User Story:** As a developer, I want a centralized data fetch coordinator that triggers when profile loads, so that all dependent data fetches happen automatically.

#### Acceptance Criteria

1. WHEN the auth store user state changes from null to a user object THEN the System SHALL trigger the data fetch coordinator
2. WHEN the data fetch coordinator starts THEN the System SHALL initiate parallel fetches for products, categories, wholesalers, and manufacturers
3. WHEN any individual data fetch completes THEN the System SHALL update the corresponding component without waiting for other fetches
4. WHEN the data fetch coordinator is already running THEN the System SHALL prevent duplicate coordinator invocations
5. WHEN the user logs out THEN the System SHALL cancel all in-progress data fetches and clear the coordinator state

### Requirement 3

**User Story:** As a user, I want home screen components to show content quickly regardless of cache state, so that I have a responsive experience.

#### Acceptance Criteria

1. WHEN DynamicHomeSections mounts THEN the System SHALL check for component-level cached data before showing loading states
2. WHEN component-level caches exist THEN the System SHALL display cached content immediately
3. WHEN the data fetch coordinator completes THEN the System SHALL update components with fresh data without flickering
4. WHEN no component-level cache exists THEN the System SHALL show loading states until the data fetch coordinator provides data
5. WHEN fresh data arrives THEN the System SHALL cache it locally for the next app session

### Requirement 4

**User Story:** As a developer, I want proper logging and debugging for cache revalidation, so that I can diagnose data fetching issues.

#### Acceptance Criteria

1. WHEN cache staleness is detected THEN the System SHALL log cache age, staleness status, and expiry time
2. WHEN background revalidation starts THEN the System SHALL log which data sources are being revalidated
3. WHEN data fetching completes or fails THEN the System SHALL log the outcome with timing information
4. WHEN components remain in loading state THEN the System SHALL log why data fetching did not trigger
5. WHEN revalidation is skipped due to cooldown THEN the System SHALL log the cooldown status and remaining time

### Requirement 5

**User Story:** As a user, I want the app to handle network failures gracefully during revalidation, so that I still see cached content even when offline.

#### Acceptance Criteria

1. WHEN revalidation fails due to network error THEN the System SHALL continue displaying stale cached data
2. WHEN the network becomes available after failure THEN the System SHALL retry revalidation automatically
3. WHEN multiple revalidation attempts fail THEN the System SHALL show a subtle notification without blocking the UI
4. WHEN the user is offline THEN the System SHALL skip revalidation and serve cached data without errors
5. WHEN revalidation succeeds after failures THEN the System SHALL update the cache and clear any error states
