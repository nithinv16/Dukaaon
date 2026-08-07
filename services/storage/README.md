# Storage Service

This directory is reserved for storage-related services.

## Planned Purpose

- File upload/download utilities
- Cloud storage integration (Firebase Storage, Supabase Storage)
- Image optimization and caching
- Document storage management

## Current Status

Currently empty. Storage functionality is handled by:
- `services/supabase/` - Supabase storage operations
- `services/firebase/` - Firebase storage operations

## Future Implementation

When implementing dedicated storage services, consider:
- Unified storage interface for multiple providers
- Automatic image compression
- Offline storage sync
- Storage quota management
