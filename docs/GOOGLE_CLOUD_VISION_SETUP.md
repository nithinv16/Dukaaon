# Google Cloud Vision OCR Setup Guide

This guide will help you set up Google Cloud Vision API for OCR (Optical Character Recognition) in the DukaaOn application.

## Overview

Google Cloud Vision API provides powerful image analysis capabilities including:
- Text detection and extraction (OCR)
- Document text detection
- Handwriting recognition
- Multi-language support
- High accuracy cloud-based processing

## Prerequisites

- Google Cloud Platform account
- Active billing account (Vision API has usage-based pricing)
- Node.js and npm installed
- Expo development environment

## Setup Instructions

### 1. Google Cloud Console Setup

#### Create a Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "dukaaon-vision")
4. Click "Create"

#### Enable Vision API
1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Cloud Vision API"
3. Click on "Cloud Vision API"
4. Click "Enable"

#### Create API Key
1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "API key"
3. Copy the generated API key
4. (Optional) Click "Restrict key" to add security restrictions

#### Set Up Billing
1. Go to "Billing" in the Google Cloud Console
2. Link a billing account to your project
3. Review Vision API pricing at [Google Cloud Pricing](https://cloud.google.com/vision/pricing)

### 2. Project Configuration

#### Install Dependencies
```bash
npm install react-native-image-picker expo-file-system
```

#### Environment Variables
Add your API key to `.env` file:
```env
EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY=your_api_key_here
```

**Important**: In React Native/Expo, environment variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the client-side code.

#### Configuration File
The configuration is already set up in `config/googleCloud.ts`:

```typescript
export const GOOGLE_CLOUD_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY || '',
  maxResults: 50,
  enableDocumentTextDetection: true,
  supportedLanguages: {
    // Indian Languages
    'hi': 'Hindi',
    'te': 'Telugu',
    'ta': 'Tamil',
    'kn': 'Kannada',
    'ml': 'Malayalam',
    'gu': 'Gujarati',
    'bn': 'Bengali',
    'mr': 'Marathi',
    'pa': 'Punjabi',
    'or': 'Odia',
    'as': 'Assamese',
    'ur': 'Urdu',
    // International Languages
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese (Simplified)',
    'ar': 'Arabic',
    // ... more languages
  },
  timeout: 30000,
  retryAttempts: 3,
};
```

### 3. Usage Examples

#### Basic OCR
```typescript
import { GoogleCloudVisionOCRService } from '../services/googleCloud/visionOCRService';

const ocrService = GoogleCloudVisionOCRService.getInstance();

// Extract text from image
const results = await ocrService.extractTextFromImage(imageUri, ['en']);
if (results && results.length > 0) {
  const extractedText = results[0]?.text?.trim() || '';
  console.log('Extracted text:', extractedText);
}
```

#### Multi-language OCR
```typescript
// Extract text with multiple language hints
const results = await ocrService.extractTextFromImage(imageUri, ['hi', 'en']);
```

#### OCR with User Interface
```typescript
// Show camera/gallery options
const results = await ocrService.showOCROptions(['en']);
```

### 4. Language Support

#### Indian Languages
- Hindi (hi)
- Telugu (te)
- Tamil (ta)
- Kannada (kn)
- Malayalam (ml)
- Gujarati (gu)
- Bengali (bn)
- Marathi (mr)
- Punjabi (pa)
- Odia (or)
- Assamese (as)
- Urdu (ur)

#### International Languages
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Russian (ru)
- Japanese (ja)
- Korean (ko)
- Chinese Simplified (zh)
- Arabic (ar)
- And many more...

### 5. Testing

#### Component Testing
```typescript
import { GoogleCloudVisionOCRService } from '../services/googleCloud/visionOCRService';

describe('Google Cloud Vision OCR', () => {
  test('should extract text from image', async () => {
    const ocrService = GoogleCloudVisionOCRService.getInstance();
    const results = await ocrService.extractTextFromImage(mockImageUri, ['en']);
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toBeDefined();
  });
});
```

#### Manual Testing
1. Use the OCRTest component in `components/test/OCRTest.tsx`
2. Test with various image types and languages
3. Verify accuracy and performance

### 6. Performance Considerations

#### Image Optimization
- Resize images to reasonable dimensions (max 2048x2048)
- Use JPEG format for photos, PNG for text documents
- Ensure good lighting and contrast

#### API Usage Optimization
- Implement caching for repeated requests
- Use appropriate language hints
- Consider batch processing for multiple images

#### Cost Management
- Monitor API usage in Google Cloud Console
- Set up billing alerts
- Implement request throttling if needed

### 7. Troubleshooting

#### Common Issues

**API Key Issues**
- Verify API key is correctly set in environment variables with `EXPO_PUBLIC_` prefix
- Check if Vision API is enabled in Google Cloud Console
- Ensure billing is set up and active
- Restart your development server after adding the API key
- Verify the API key is not restricted to specific IPs or referrers that block your requests

**Authentication Errors**
```
Error: API request failed: 403 - {
  "error": {
    "code": 403,
    "message": "Method doesn't allow unregistered callers (callers without established identity). Please use API Key or other form of API consumer identity to call this API.",
    "status": "PERMISSION_DENIED"
  }
}
```
- **Solution**: This error indicates the API key is not being sent or recognized
- Check that your `.env` file contains: `EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY=your_actual_api_key`
- Ensure you restart your Expo development server after adding the environment variable
- Verify the API key is valid and not expired
- Check that the Vision API is enabled in your Google Cloud project
- Ensure your Google Cloud project has billing enabled

**Quota Exceeded**
```
Error: API request failed: 429 - Too Many Requests
```
- Solution: Check quota limits in Google Cloud Console
- Implement request throttling

**Network Issues**
```
Error: Network request failed
```
- Solution: Check internet connectivity
- Verify firewall settings

**Poor OCR Accuracy**
- Ensure good image quality
- Use appropriate language hints
- Check image orientation and lighting

### 8. Security Best Practices

#### API Key Security
- Never commit API keys to version control
- Use environment variables for API keys
- Restrict API key usage to specific APIs and domains
- Rotate API keys regularly

#### Data Privacy
- Images are processed by Google Cloud (not stored permanently)
- Review Google Cloud's data processing terms
- Consider data residency requirements

### 9. Benefits and Limitations

#### Benefits
- High accuracy OCR results
- Support for 100+ languages
- Handles various document types
- Robust handwriting recognition
- Automatic text orientation detection
- Structured output with bounding boxes

#### Limitations
- Requires internet connection
- Usage-based pricing
- API rate limits
- Dependency on Google Cloud service availability

### 10. Migration from Other OCR Services

If migrating from Tesseract or other OCR services:

1. Update import statements
2. Change language codes (e.g., 'eng' → 'en', 'hin' → 'hi')
3. Update method calls to use array format for language hints
4. Handle different response format
5. Set up Google Cloud credentials

### 11. Support and Resources

#### Documentation
- [Google Cloud Vision API Documentation](https://cloud.google.com/vision/docs)
- [Vision API Pricing](https://cloud.google.com/vision/pricing)
- [Supported Languages](https://cloud.google.com/vision/docs/languages)

#### Community
- [Google Cloud Community](https://cloud.google.com/community)
- [Stack Overflow - google-cloud-vision](https://stackoverflow.com/questions/tagged/google-cloud-vision)

#### Support
- Google Cloud Support (for paid accounts)
- Community forums
- GitHub issues for this project

---

**Note**: This setup guide assumes you have the necessary permissions and billing setup in Google Cloud Platform. Make sure to review pricing and usage limits before implementing in production.