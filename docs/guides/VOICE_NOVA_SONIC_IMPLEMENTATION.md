# Voice Recognition Implementation with Amazon Nova Sonic

This document describes the implementation of voice recognition functionality in the Dukaaon AI Chat Interface using Amazon Nova Sonic v1:0 model.

## Overview

The voice recognition system now supports both web and React Native platforms:
- **Web Platform**: Uses browser's native Web Speech API
- **React Native (iOS/Android)**: Uses Amazon Nova Sonic v1:0 via AWS Bedrock

## Architecture

### Components

1. **NovaSonicService** (`services/voice/novaSonicService.ts`)
   - Handles audio recording using expo-av
   - Manages audio file operations with expo-file-system
   - Integrates with AWS Bedrock Runtime for transcription
   - Provides clean API for recording and transcription

2. **VoiceService** (`services/voice/voiceService.ts`)
   - Unified interface for voice recognition across platforms
   - Automatically switches between Web Speech API and Nova Sonic
   - Manages text-to-speech using expo-speech
   - Provides callback-based event system

3. **AIChatInterface** (`components/ai/AIChatInterface.tsx`)
   - Integrates voice button in chat interface
   - Manages voice recording state (listening/speaking)
   - Automatically sends transcribed text to AI chat
   - Speaks AI responses using text-to-speech

## Features

### Speech-to-Text
- **Platform Detection**: Automatically uses appropriate service based on platform
- **Audio Recording**: Records high-quality 16kHz mono WAV audio
- **Real-time Transcription**: Converts speech to text using Nova Sonic
- **Auto-stop**: Automatically stops recording after 10 seconds (configurable)
- **Error Handling**: Comprehensive error messages for debugging

### Text-to-Speech
- **Cross-platform**: Works on web, iOS, and Android
- **AI Response Reading**: Automatically reads AI responses aloud
- **Manual Control**: Stop speaking with long-press on voice button
- **Customizable**: Adjustable speech rate, pitch, and language

## Configuration

### Environment Variables

Required environment variables in `.env`:

```env
# AWS Bedrock Configuration
EXPO_PUBLIC_AWS_BEDROCK_API_KEY=<your-api-key>
EXPO_PUBLIC_AWS_ACCESS_KEY_ID=<your-access-key>
EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY=<your-secret-key>
EXPO_PUBLIC_AWS_REGION=us-east-1
```

### Audio Settings

The NovaSonicService is configured for optimal speech recognition:

```typescript
{
  sampleRate: 16000,    // 16kHz sample rate
  numberOfChannels: 1,  // Mono audio
  bitRate: 128000,      // 128kbps
  format: 'wav'         // WAV format
}
```

## Usage

### In AI Chat Interface

The voice button is automatically integrated:

```typescript
<AIChatInterface
  userId={userId}
  showVoiceButton={true}  // Enable voice button
  placeholder="Ask Dai anything..."
/>
```

### Button States

1. **Idle** (blue mic-outline icon): Ready to record
2. **Listening** (red mic icon): Recording audio
3. **Speaking** (orange volume icon): Playing AI response

### User Interactions

1. **Tap voice button**: Start/stop recording
2. **Long-press voice button**: Stop current AI speech
3. **Auto-send**: Transcribed text is automatically sent to chat

## API Reference

### NovaSonicService

```typescript
class NovaSonicService {
  // Start recording audio
  async startRecording(): Promise<void>
  
  // Stop recording and get audio file URI
  async stopRecording(): Promise<string | null>
  
  // Transcribe audio file
  async transcribe(audioUri: string): Promise<NovaTranscriptionResult>
  
  // Check recording status
  isCurrentlyRecording(): boolean
  
  // Cleanup resources
  async cleanup(): Promise<void>
}

interface NovaTranscriptionResult {
  transcript: string;
  confidence?: number;
  languageCode?: string;
}
```

### VoiceService

```typescript
class VoiceService {
  // Speech-to-text
  async startListening(): Promise<void>
  async stopListening(): Promise<void>
  
  // Text-to-speech
  async speak(text: string, options?: TextToSpeechOptions): Promise<void>
  async stopSpeaking(): Promise<void>
  
  // Status checks
  isCurrentlyListening(): boolean
  isCurrentlySpeaking(): boolean
  
  // Callbacks
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  onSpeechResult?: (transcript: string) => void
  onSpeechError?: (error: string) => void
  onSpeakStart?: () => void
  onSpeakEnd?: () => void
  
  // Cleanup
  async destroy(): Promise<void>
}
```

## AWS Bedrock Integration

### Nova Sonic Model

Model ID: `amazon.nova-sonic-v1:0`

Request payload structure:
```json
{
  "audio": "<base64-encoded-audio>",
  "inputModality": "AUDIO",
  "outputModality": "TEXT",
  "audioConfig": {
    "format": "wav",
    "sampleRate": 16000
  },
  "inferenceConfig": {
    "temperature": 0.3,
    "maxTokens": 1000
  }
}
```

Response structure:
```json
{
  "output": {
    "text": "transcribed text here"
  },
  "confidence": 0.95,
  "languageCode": "en-US"
}
```

## Permissions

### iOS (ios/Info.plist)

```xml
<key>NSMicrophoneUsageDescription</key>
<string>We need access to your microphone for voice commands</string>
```

### Android (android/app/src/main/AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

## Error Handling

Common errors and solutions:

1. **"Audio recording permission not granted"**
   - Solution: Request microphone permissions
   - Check app settings on device

2. **"AWS Bedrock API key not configured"**
   - Solution: Verify .env file has correct AWS credentials
   - Ensure environment variables are loaded

3. **"Failed to transcribe audio"**
   - Solution: Check AWS credentials and region
   - Verify audio file format (should be WAV)
   - Check network connectivity

4. **"No active recording"**
   - Solution: Start recording before trying to stop
   - Check if another app is using the microphone

## Performance Considerations

- **Recording Duration**: Default 10-second limit prevents excessive recording
- **Audio Format**: WAV format chosen for compatibility with Nova Sonic
- **Transcription Time**: Typically 1-3 seconds depending on audio length
- **Network**: Requires internet connection for transcription
- **Battery**: Voice features use moderate battery due to network calls

## Testing

### Manual Testing Steps

1. Launch app with AI chat interface
2. Tap microphone button
3. Speak clearly for 2-5 seconds
4. Wait for automatic stop or tap button again
5. Verify transcribed text appears in input field
6. Message should auto-send to AI
7. AI response should be spoken aloud

### Test Scenarios

- [ ] Short utterance (1-2 words)
- [ ] Long utterance (full sentence)
- [ ] Multiple consecutive recordings
- [ ] Stop while recording
- [ ] Stop while speaking
- [ ] Permission denied handling
- [ ] Network error handling
- [ ] Background/foreground transitions

## Troubleshooting

### No Transcription Results

Check:
1. Microphone permissions granted
2. AWS credentials configured correctly
3. Internet connection active
4. Audio is being recorded (check logs)
5. Nova Sonic model accessible in your AWS region

### Poor Transcription Quality

Improve by:
1. Speaking clearly and slowly
2. Reducing background noise
3. Holding device closer to mouth
4. Using in quiet environment
5. Checking microphone hardware

## Future Enhancements

Potential improvements:

1. **Voice Activity Detection**: Automatically detect when user stops speaking
2. **Multi-language Support**: Support for additional languages
3. **Offline Mode**: Cache common phrases for offline transcription
4. **Custom Wake Word**: "Hey Dai" to activate voice input
5. **Continuous Conversation**: Keep microphone active between exchanges
6. **Speaker Identification**: Distinguish between multiple speakers
7. **Noise Cancellation**: Improve audio quality with noise filtering

## Security Considerations

- Audio files are temporary and deleted after transcription
- AWS credentials stored securely in environment variables
- No audio data persisted on device
- Transcription requests encrypted in transit (HTTPS)
- Consider implementing audio data encryption at rest for sensitive applications

## Dependencies

Required packages:
```json
{
  "expo-av": "^18.0.12",
  "expo-file-system": "^18.0.12",
  "expo-speech": "^13.0.1",
  "@aws-sdk/client-bedrock-runtime": "^3.901.0"
}
```

## Support

For issues or questions:
- Check this documentation first
- Review console logs for error messages
- Verify AWS Bedrock service status
- Test microphone with other apps
- Contact development team with detailed error logs
