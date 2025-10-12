# OCR Translation Integration Guide

This guide explains the new translation features integrated into the OCR Scanner component, enabling automatic translation of extracted text for better search results.

## Overview

The OCR Scanner now includes intelligent translation capabilities that:
- Automatically detect the language of extracted text
- Translate non-English text to English for improved search results
- Provide both original and translated text to search functions
- Support manual translation controls
- Fall back gracefully when translation services are unavailable

## Features

### 1. Automatic Language Detection
- Uses Azure Translator for primary language detection
- Falls back to local translation service if Azure is unavailable
- Supports multiple language detection algorithms

### 2. Smart Translation
- Automatically translates non-English text to English
- Preserves original text alongside translations
- Uses Azure Translation Service with fallback to local service
- Optimizes search queries for better results

### 3. User Controls
- Toggle for enabling/disabling auto-translation
- Manual translation button for on-demand translation
- Visual indicators for translation status
- Clear display of both original and translated text

## Implementation

### OCRScanner Component Props

```typescript
interface OCRScannerProps {
  // ... existing props
  enableTranslation?: boolean;    // Enable translation features (default: true)
  autoTranslate?: boolean;        // Auto-translate on text extraction (default: true)
  onSearchResult?: (
    query: string, 
    language: string, 
    translatedQuery?: string, 
    originalText?: string
  ) => void;
}
```

### Usage Examples

#### Basic Usage with Translation
```tsx
<OCRScanner
  onSearchResult={handleSearchResult}
  enableTranslation={true}
  autoTranslate={true}
  buttonText="Smart OCR Scan"
/>
```

#### Handling Search Results
```typescript
const handleSearchResult = (
  query: string, 
  language: string, 
  translatedQuery?: string, 
  originalText?: string
) => {
  console.log('Search query:', query);
  console.log('Language:', language);
  
  if (translatedQuery) {
    console.log('Translated query:', translatedQuery);
    console.log('Original text:', originalText);
    
    // Use translated query for search
    performSearch(translatedQuery);
  } else {
    // Use original query
    performSearch(query);
  }
};
```

#### Translation-Disabled Mode
```tsx
<OCRScanner
  onSearchResult={handleSearchResult}
  enableTranslation={false}
  buttonText="Basic OCR Scan"
/>
```

## Translation Services

### Azure Translation Service
- Primary translation service
- Requires Azure Translator API key
- Supports 100+ languages
- High accuracy and reliability

### Fallback Translation Service
- Local translation service
- Used when Azure is unavailable
- Basic translation capabilities
- Ensures functionality even without Azure

## Configuration

### Environment Variables
Ensure these environment variables are set:

```env
# Azure Translator (Primary)
EXPO_PUBLIC_AZURE_TRANSLATOR_KEY=your_azure_translator_key
EXPO_PUBLIC_AZURE_TRANSLATOR_REGION=your_azure_region

# Google Cloud (Fallback)
EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY=your_google_cloud_key
```

### Service Initialization
The translation services are automatically initialized when the OCR component loads.

## User Interface

### Translation Controls
- **Auto-translate Toggle**: Enable/disable automatic translation
- **Manual Translate Button**: Translate text on demand
- **Translation Status**: Visual indicators for translation progress

### Text Display
- **Original Text**: Shows extracted text in original language
- **Translated Text**: Shows English translation (when available)
- **Language Detection**: Displays detected language with confidence

### Search Integration
- **Smart Search Button**: Changes to "Smart Search" when translation is active
- **Dual Query Support**: Searches using both original and translated text
- **Fallback Handling**: Graceful degradation when translation fails

## Error Handling

### Translation Failures
- Falls back to original text if translation fails
- Displays user-friendly error messages
- Logs detailed errors for debugging

### Service Unavailability
- Automatically switches to fallback service
- Continues OCR functionality even without translation
- Provides clear status indicators

## Best Practices

### Performance
- Translation is performed asynchronously
- Results are cached to avoid repeated translations
- Network requests are optimized for mobile

### User Experience
- Clear visual feedback during translation
- Option to disable translation for faster scanning
- Preserves original text for user reference

### Error Recovery
- Graceful fallback to original text
- Clear error messages without technical jargon
- Retry mechanisms for temporary failures

## Integration Examples

### Home Screen Integration
```typescript
// In app/(main)/home/index.tsx
const handleOCRSearchResult = async (
  query: string,
  language: string,
  translatedQuery?: string,
  originalText?: string
) => {
  try {
    // Use ProductSearchService for enhanced search
    const searchQuery = translatedQuery || query;
    const results = await ProductSearchService.searchProducts(searchQuery);
    
    // Navigate to search results
    router.push({
      pathname: '/search',
      params: {
        query: searchQuery,
        originalQuery: originalText,
        translatedQuery,
        resultsCount: results.length
      }
    });
  } catch (error) {
    // Fallback to simple navigation
    router.push(`/search?query=${encodeURIComponent(query)}`);
  }
};
```

### Header Component Integration
```typescript
// In components/home/Header.tsx
interface HeaderProps {
  onOCRSearchResult?: (
    query: string,
    language: string,
    translatedQuery?: string,
    originalText?: string
  ) => void;
}

// Usage
<OCRScanner
  onSearchResult={onOCRSearchResult}
  enableTranslation={true}
  autoTranslate={true}
  compact={true}
/>
```

## Testing

### Test Cases
1. **English Text**: Should not trigger translation
2. **Non-English Text**: Should automatically translate
3. **Mixed Language**: Should handle appropriately
4. **Service Failures**: Should fall back gracefully
5. **Network Issues**: Should continue basic OCR functionality

### Test Component
Use the `OCRTest` component in `components/test/OCRTest.tsx` to test translation features:

```typescript
// Test with translation enabled
<OCRScanner
  onSearchResult={handleSearchResult}
  enableTranslation={true}
  autoTranslate={true}
  buttonText="Test Translation OCR"
/>
```

## Troubleshooting

### Common Issues

1. **Translation Not Working**
   - Check Azure Translator API key
   - Verify network connectivity
   - Check service configuration

2. **Slow Translation**
   - Check network speed
   - Consider disabling auto-translate
   - Use manual translation instead

3. **Incorrect Language Detection**
   - Ensure text is clear and readable
   - Try manual language selection
   - Check OCR quality settings

### Debug Information
Enable debug logging to see detailed translation information:

```typescript
// In development, check console for:
// - Language detection results
// - Translation service responses
// - Fallback service usage
// - Error details
```

## Future Enhancements

- Support for more translation services
- Offline translation capabilities
- Custom language preferences
- Translation confidence scoring
- Batch translation for multiple texts

## Related Documentation

- [OCR Implementation Guide](./OCR_IMPLEMENTATION.md)
- [Azure AI Setup](../AZURE_AI_SETUP.md)
- [Google Cloud Vision Setup](./GOOGLE_CLOUD_VISION_SETUP.md)
- [Voice Search Implementation](../VOICE_SEARCH_IMPLEMENTATION.md)