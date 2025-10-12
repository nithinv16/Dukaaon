# Hybrid Language Detection for OCR

This document explains the new hybrid language detection feature implemented in the Google Cloud Vision OCR Service.

## Overview

The hybrid language detection system combines the app's current language setting with Google Cloud Vision's automatic language detection to provide more accurate and user-friendly OCR results.

## How It Works

### 1. Primary Detection: App Language
- The system first retrieves the user's current app language from storage
- This language is used as the primary choice for OCR text detection
- Reduces unnecessary API calls and provides consistent user experience

### 2. Fallback Detection: Google Cloud Vision
- Google Cloud Vision API still performs automatic language detection
- If Vision API has very high confidence (>90%), it can override the app language
- If Vision API confidence is moderate (80-90%), it confirms the app language choice
- If Vision API confidence is low (<80%), app language is maintained

### 3. Decision Logic

```typescript
if (visionDetectedLanguage && highestConfidence > 0.8) {
  if (appLanguage !== visionDetectedLanguage) {
    if (highestConfidence > 0.9) {
      // Use Vision API language (very high confidence)
      finalLanguage = visionDetectedLanguage;
      detectionMethod = 'vision_override';
    } else {
      // Keep app language (moderate confidence)
      finalLanguage = appLanguage;
      detectionMethod = 'app_primary';
    }
  } else {
    // App language confirmed by Vision API
    finalLanguage = appLanguage;
    detectionMethod = 'app_confirmed';
  }
} else {
  // Use app language (low or no Vision confidence)
  finalLanguage = appLanguage;
  detectionMethod = 'app_primary';
}
```

## Usage Examples

### 1. Default Hybrid Detection (Recommended)

```typescript
const ocrService = new GoogleCloudVisionOCRService();

// Uses hybrid detection automatically
const results = await ocrService.extractTextWithAutoDetection(imageUri);
console.log('Detected language:', results[0].detectedLanguage);
```

### 2. Configurable Detection Modes

```typescript
// Force app language only (fastest, most consistent)
const appOnlyResults = await ocrService.extractTextWithLanguageMode(
  imageUri, 
  'app_only'
);

// Use Vision API detection only (legacy behavior)
const visionOnlyResults = await ocrService.extractTextWithLanguageMode(
  imageUri, 
  'vision_only', 
  ['en', 'hi'] // optional language hints
);

// Hybrid with language hints (most accurate)
const hybridResults = await ocrService.extractTextWithLanguageMode(
  imageUri, 
  'hybrid', 
  ['te', 'kn'] // additional language hints
);
```

### 3. OCR Options with Hybrid Detection

```typescript
// Camera or gallery selection with hybrid detection
const results = await ocrService.showOCROptions(['hi', 'en']);
```

## Benefits

### 1. Performance Improvements
- Reduced API calls for language detection
- Faster response times
- Lower costs

### 2. User Experience
- Consistent language detection based on user preferences
- Automatic fallback for accuracy when needed
- Transparent operation with detailed logging

### 3. Flexibility
- Multiple detection modes for different use cases
- Configurable confidence thresholds
- Backward compatibility with existing code

## Configuration

### App Language Sources
The system checks for app language in this order:
1. Settings store (`dukaaon-settings` → `state.language`)
2. Direct language storage (`selectedLanguage`)
3. Default to English (`en`)

### Confidence Thresholds
- **High confidence**: >90% - Vision API can override app language
- **Moderate confidence**: 80-90% - App language is maintained but confirmed
- **Low confidence**: <80% - App language is used exclusively

## Logging and Debugging

The system provides detailed console logging:

```
Using app language as primary: hi
Full text detected: [OCR text content]
Page 1 detected languages:
  - hi: 95.2% confidence
  - en: 4.8% confidence
App language hi confirmed by Vision API (95.2% confidence)
Final language decision: hi (method: app_confirmed)
```

## Migration Guide

### From Legacy OCR Service

```typescript
// Old way (Vision API only)
const results = await ocrService.extractTextFromImage(imageUri, ['en', 'hi']);

// New way (Hybrid detection)
const results = await ocrService.extractTextWithAutoDetection(imageUri);
// or
const results = await ocrService.extractTextWithLanguageMode(imageUri, 'hybrid', ['en', 'hi']);
```

### Maintaining Legacy Behavior

If you need the old behavior (Vision API only):

```typescript
const results = await ocrService.extractTextWithLanguageMode(
  imageUri, 
  'vision_only', 
  languageHints
);
```

## Supported Languages

The system supports all languages available in:
- Google Cloud Vision API
- App's language settings
- Azure Translation Service (for text translation)

Common languages:
- English (`en`)
- Hindi (`hi`)
- Telugu (`te`)
- Tamil (`ta`)
- Kannada (`kn`)
- Malayalam (`ml`)
- Gujarati (`gu`)
- Bengali (`bn`)
- Marathi (`mr`)
- Punjabi (`pa`)
- Odia (`or`)

## Error Handling

The system gracefully handles:
- Missing app language settings (defaults to English)
- JSON parsing errors in storage
- Network failures (maintains app language)
- Invalid language codes (falls back to English)

## Future Enhancements

1. **User Preferences**: Allow users to configure detection behavior
2. **Learning System**: Improve detection based on user corrections
3. **Regional Variants**: Support for regional language variants
4. **Confidence Tuning**: User-configurable confidence thresholds
5. **Analytics**: Track detection accuracy and user satisfaction