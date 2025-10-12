# OCR Implementation Guide

## Overview

This document describes the OCR (Optical Character Recognition) implementation in the Dukaaon app using Azure Computer Vision API. The OCR functionality allows users to extract text from images captured via camera or selected from the device gallery.

## Features

### 🔍 OCR Scanner Component
- **Camera Capture**: Take photos directly from the camera for text extraction
- **Gallery Selection**: Choose existing images from the device gallery
- **Real-time Processing**: Live feedback during text extraction
- **Language Detection**: Automatic detection of text language
- **Search Integration**: Direct search functionality with extracted text
- **Modern UI**: Beautiful modal interface with Material Design components

### 🎯 Integration Points
- **VoiceSearch Component**: OCR button alongside voice search
- **EnhancedVoiceSearch Component**: Advanced OCR integration
- **Standalone Usage**: Can be used independently in any component

## Technical Implementation

### Core Components

#### 1. OCRScanner Component (`components/common/OCRScanner.tsx`)
A reusable React Native component that provides:
- Image capture and selection
- Azure Computer Vision API integration
- Modal interface for user interaction
- Callback functions for text extraction and search

#### 2. Azure OCR Service (`services/azureAI/ocrService.ts`)
Service layer that handles:
- Azure Computer Vision API calls
- Image processing and base64 conversion
- Permission management for camera and gallery
- Error handling and retry logic

#### 3. Azure AI Configuration (`config/azureAI.ts`)
Configuration management for:
- API endpoints and keys
- OCR-specific settings
- Environment variable validation

### API Integration

#### Azure Computer Vision API
- **Endpoint**: `https://nithinvthomas96-2178-resource.cognitiveservices.azure.com/`
- **API Version**: `2023-02-01-preview`
- **Features Used**:
  - Read API for text extraction
  - Language detection
  - Orientation detection
  - Handwriting recognition

#### Request Flow
1. Image capture/selection
2. Convert to base64 format
3. Submit to Azure Computer Vision
4. Poll for results (async operation)
5. Parse and return extracted text

## Usage Examples

### Basic Usage
```tsx
import OCRScanner from '../components/common/OCRScanner';

const MyComponent = () => {
  const handleTextExtracted = (text: string, language: string) => {
    console.log('Extracted text:', text);
    console.log('Detected language:', language);
  };

  const handleSearchResult = (query: string, language: string) => {
    // Perform search with extracted text
    performSearch(query);
  };

  return (
    <OCRScanner
      onTextExtracted={handleTextExtracted}
      onSearchResult={handleSearchResult}
      buttonText="Scan Text"
      showModal={true}
    />
  );
};
```

### Advanced Usage with Custom Styling
```tsx
<OCRScanner
  onTextExtracted={handleTextExtracted}
  onSearchResult={handleSearchResult}
  style={{
    backgroundColor: '#custom-color',
    borderRadius: 15,
  }}
  buttonText="Custom OCR"
  showModal={false} // Use alerts instead of modal
/>
```

### Direct Service Usage
```tsx
import AzureOCRService from '../services/azureAI/ocrService';

const performOCR = async () => {
  try {
    const result = await AzureOCRService.captureImageForOCR();
    if (result.success) {
      console.log('Text:', result.extractedText);
      console.log('Language:', result.language);
    }
  } catch (error) {
    console.error('OCR failed:', error);
  }
};
```

## Configuration

### Environment Variables
Add these to your `.env` file:

```env
# Azure Computer Vision (OCR)
EXPO_PUBLIC_AZURE_COMPUTER_VISION_KEY=your_api_key_here
EXPO_PUBLIC_AZURE_COMPUTER_VISION_REGION=your_region_here
EXPO_PUBLIC_AZURE_COMPUTER_VISION_ENDPOINT=your_endpoint_here
```

### OCR Settings
Customize OCR behavior in `config/azureAI.ts`:

```typescript
export const OCR_CONFIG = {
  language: 'en', // Default language
  detectOrientation: true,
  includeHandwriting: true,
  timeout: 30000, // 30 seconds
};
```

## Dependencies

### Required Packages
- `react-native-image-picker`: Image capture and gallery access
- `react-native-paper`: UI components
- `@expo/vector-icons`: Icons

### Installation
```bash
npm install react-native-image-picker
npm install react-native-paper
```

## Permissions

### iOS (Info.plist)
Add the following permissions to your Info.plist:
```xml
<key>NSCameraUsageDescription</key>
<string>The app accesses your camera to capture images for text extraction.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>The app accesses your photos to extract text from images.</string>
```

### Android (AndroidManifest.xml)
Add the following permissions:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

Permissions are handled internally by react-native-image-picker.

## Error Handling

### Common Issues
1. **Permission Denied**: User denied camera/gallery access
2. **Network Error**: API connectivity issues
3. **Invalid Image**: Unsupported image format
4. **No Text Found**: Image contains no readable text
5. **API Quota Exceeded**: Azure API limits reached

### Error Recovery
- Automatic retry for network failures
- User-friendly error messages
- Fallback options for permission issues

## Performance Considerations

### Image Optimization
- Automatic image compression
- Maximum resolution limits
- Base64 encoding optimization

### API Efficiency
- Request batching where possible
- Caching for repeated requests
- Timeout management

## Testing

### Test Scenarios
1. **Camera Capture**: Test with various lighting conditions
2. **Gallery Selection**: Test with different image formats
3. **Text Types**: Test with printed text, handwriting, different languages
4. **Error Cases**: Test network failures, permission denials
5. **Performance**: Test with large images, multiple requests

### Test Images
Recommended test cases:
- Business cards
- Documents with multiple languages
- Handwritten notes
- Screenshots with text
- Images with poor lighting

## Future Enhancements

### Planned Features
- [ ] Offline OCR capability
- [ ] Text translation integration
- [ ] Document scanning with multiple pages
- [ ] Text formatting preservation
- [ ] Custom OCR models
- [ ] Batch processing

### Performance Improvements
- [ ] Image preprocessing
- [ ] Result caching
- [ ] Progressive loading
- [ ] Background processing

## Troubleshooting

### Common Solutions

#### OCR Not Working
1. Check environment variables
2. Verify Azure API key and endpoint
3. Ensure proper permissions
4. Check network connectivity

#### Poor Text Recognition
1. Improve image quality
2. Ensure good lighting
3. Check text orientation
4. Try different image formats

#### Performance Issues
1. Reduce image size
2. Check API quota
3. Optimize network requests
4. Monitor memory usage

## Support

For issues and questions:
1. Check this documentation
2. Review error logs
3. Test with sample images
4. Contact development team

---

*Last updated: January 2025*