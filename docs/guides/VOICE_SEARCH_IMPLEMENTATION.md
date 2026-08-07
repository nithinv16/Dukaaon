# Voice Search Implementation Guide

## Overview

The Enhanced Voice Search component has been updated to address React Native compatibility issues with the Azure Speech SDK. The implementation now uses a platform-specific approach to provide the best user experience across different environments.

## Platform Compatibility

### Web Platform ✅
- **Primary Implementation**: Uses `react-speech-recognition` library with Web Speech API
- **Features**: Full voice recognition, real-time transcription, language detection
- **Azure Integration**: Language detection and translation services
- **Browser Support**: Chrome (best), Firefox, Safari (limited)

### React Native Platform ⚠️
- **Current Status**: Limited implementation due to Azure Speech SDK compatibility issues
- **Error**: `Web Audio API (AudioContext is not available)` - This is a known limitation
- **Fallback**: Graceful degradation with user guidance to use web version
- **Future Enhancement**: Can be improved with native speech recognition modules

## Technical Implementation

### Key Changes Made

1. **Platform Detection**: Uses `Platform.OS` to determine execution environment
2. **Conditional Imports**: Dynamic loading of speech recognition libraries
3. **Error Handling**: Specific error messages for platform compatibility issues
4. **Graceful Degradation**: Fallback options when speech recognition is unavailable

### Dependencies

```json
{
  "react-speech-recognition": "^3.10.0",
  "microsoft-cognitiveservices-speech-sdk": "^1.44.1",
  "expo-speech": "~12.1.0"
}
```

### Code Structure

```typescript
// Platform-specific imports
if (Platform.OS === 'web') {
  const speechModule = require('react-speech-recognition');
  SpeechRecognition = speechModule.default;
  useSpeechRecognition = speechModule.useSpeechRecognition;
}

// Platform-specific implementation
if (Platform.OS === 'web' && SpeechRecognition) {
  await startWebSpeechRecognition();
} else {
  await startReactNativeSpeechRecognition();
}
```

## Error Resolution

### Common Errors and Solutions

1. **"Web Audio API not available"**
   - **Cause**: Azure Speech SDK trying to use browser APIs in React Native
   - **Solution**: Use web version of the app for voice search
   - **Status**: Resolved with platform detection

2. **"this.privAudioSource.id is not a function"**
   - **Cause**: React Native incompatibility with Azure Speech SDK audio handling
   - **Solution**: Implemented alternative approach using react-speech-recognition
   - **Status**: Resolved

3. **"Speech recognition not available"**
   - **Cause**: Browser doesn't support Web Speech API
   - **Solution**: Provide fallback to text search
   - **Status**: Handled with graceful degradation

## Usage Guidelines

### For Web Applications
```typescript
<EnhancedVoiceSearch
  onSearchResult={(query, language, intent, entities) => {
    // Handle search results
  }}
  onOrderResult={(product, quantity, language) => {
    // Handle order intent
  }}
  placeholder="Tap to speak in any language..."
/>
```

### For React Native Applications
- Component will display appropriate messaging
- Users are guided to use web version for optimal experience
- Text search alternatives are provided

## Future Enhancements

### React Native Improvements
1. **Native Speech Recognition**: Implement platform-specific native modules
2. **Expo Speech Integration**: Enhanced integration with expo-speech
3. **Voice Activity Detection**: Implement custom audio processing
4. **Offline Capabilities**: Add offline speech recognition options

### Web Enhancements
1. **Azure Polyfill**: Implement Azure Speech Services as Web Speech API polyfill
2. **Enhanced Language Support**: Expand supported languages
3. **Custom Wake Words**: Implement custom activation phrases
4. **Voice Commands**: Add predefined voice command recognition

## Configuration

### Environment Variables
Ensure these are set in your `.env` file:
```
EXPO_PUBLIC_AZURE_SPEECH_KEY=your_speech_key
EXPO_PUBLIC_AZURE_SPEECH_REGION=your_region
EXPO_PUBLIC_AZURE_TRANSLATOR_KEY=your_translator_key
EXPO_PUBLIC_AZURE_TRANSLATOR_REGION=your_translator_region
```

### Supported Languages
- English (en-US)
- Hindi (hi-IN)
- Telugu (te-IN)
- Tamil (ta-IN)
- Kannada (kn-IN)
- Malayalam (ml-IN)
- Bengali (bn-IN)
- Gujarati (gu-IN)
- Marathi (mr-IN)
- Punjabi (pa-IN)

## Testing

### Web Testing
1. Open application in Chrome browser
2. Grant microphone permissions
3. Test voice search functionality
4. Verify language detection and translation

### React Native Testing
1. Run on device/simulator
2. Verify graceful error handling
3. Test fallback to text search
4. Confirm user guidance messages

## Troubleshooting

### Common Issues

1. **Microphone Permission Denied**
   - Check browser permissions
   - Ensure HTTPS connection for web

2. **No Speech Detected**
   - Check microphone functionality
   - Verify audio input levels
   - Test in quiet environment

3. **Language Detection Errors**
   - Verify Azure AI services configuration
   - Check API key validity
   - Ensure network connectivity

### Debug Mode
Enable detailed logging by setting:
```typescript
console.log('Voice search debug mode enabled');
```

## Support

For issues related to:
- **Web Speech API**: Check browser compatibility
- **Azure Services**: Verify configuration and quotas
- **React Native**: Consider native module alternatives
- **General Issues**: Check network connectivity and permissions