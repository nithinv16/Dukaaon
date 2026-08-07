# AWS Speech Services Integration Guide

This guide explains how to integrate and use AWS Transcribe (Speech-to-Text) and AWS Polly (Text-to-Speech) services in the Dukaaon application alongside existing Azure Speech Services.

## Overview

The application now supports both Azure Speech Services and AWS Speech Services with:
- **AWS Transcribe**: Real-time and batch speech-to-text conversion
- **AWS Polly**: High-quality text-to-speech synthesis
- **Unified Service Layer**: Seamless switching between providers
- **Fallback Support**: Automatic failover between services
- **Multi-language Support**: Support for Indian and international languages

## Prerequisites

### AWS Account Setup
1. Create an AWS account if you don't have one
2. Set up IAM user with appropriate permissions
3. Create S3 bucket for audio file storage (required for Transcribe)
4. Note your AWS region

### Required AWS Permissions
Your IAM user needs the following permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "transcribe:*",
                "polly:*",
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "*"
        }
    ]
}
```

## Installation

The required AWS SDK packages are already installed:
```bash
npm install @aws-sdk/client-transcribe @aws-sdk/client-polly @aws-sdk/credential-providers
```

## Configuration

### Environment Variables
Add the following to your `.env` file:

```env
# AWS Speech Services
EXPO_PUBLIC_AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
EXPO_PUBLIC_AWS_REGION=us-east-1
EXPO_PUBLIC_AWS_TRANSCRIBE_BUCKET=your-transcribe-bucket-name
EXPO_PUBLIC_AWS_POLLY_OUTPUT_FORMAT=mp3
EXPO_PUBLIC_AWS_POLLY_VOICE_ID=Joanna
EXPO_PUBLIC_AWS_POLLY_ENGINE=neural

# Speech Service Configuration
EXPO_PUBLIC_SPEECH_PROVIDER=azure  # or 'aws' or 'auto'
EXPO_PUBLIC_SPEECH_FALLBACK_ENABLED=true
EXPO_PUBLIC_AZURE_SPEECH_ENABLED=true
EXPO_PUBLIC_AWS_SPEECH_ENABLED=true
```

### Configuration Options

| Variable | Description | Default | Options |
|----------|-------------|---------|----------|
| `SPEECH_PROVIDER` | Primary speech provider | `azure` | `azure`, `aws`, `auto` |
| `SPEECH_FALLBACK_ENABLED` | Enable automatic fallback | `true` | `true`, `false` |
| `AZURE_SPEECH_ENABLED` | Enable Azure services | `true` | `true`, `false` |
| `AWS_SPEECH_ENABLED` | Enable AWS services | `true` | `true`, `false` |
| `AWS_POLLY_ENGINE` | Polly voice engine | `neural` | `neural`, `standard` |
| `AWS_POLLY_OUTPUT_FORMAT` | Audio output format | `mp3` | `mp3`, `ogg_vorbis`, `pcm` |

## Usage

### Basic Usage with Unified Service

```typescript
import { getUnifiedSpeechService } from '../services/speechService';

const speechService = getUnifiedSpeechService();

// Speech to Text
const sttResult = await speechService.speechToText(audioUri, 'en-US');
console.log('Transcribed text:', sttResult.text);
console.log('Provider used:', sttResult.provider);

// Text to Speech
const ttsResult = await speechService.textToSpeech('Hello, welcome to Dukaaon!', 'en-US');
console.log('Audio URL:', ttsResult.audioUrl);
console.log('Provider used:', ttsResult.provider);

// Voice Search
const searchResult = await speechService.voiceSearch('en-US');
console.log('Search query:', searchResult.searchQuery);
console.log('Intent:', searchResult.intent);
```

### Provider-Specific Configuration

```typescript
import { getUnifiedSpeechService } from '../services/speechService';

// Configure to prefer AWS
const speechService = getUnifiedSpeechService({
  preferredProvider: 'aws',
  fallbackEnabled: true,
  azureEnabled: true,
  awsEnabled: true
});

// Switch provider at runtime
speechService.switchProvider('aws');
console.log('Current provider:', speechService.getCurrentProvider());
```

### Continuous Speech Recognition

```typescript
const recognizer = await speechService.startContinuousRecognition(
  'en-US',
  (result) => {
    console.log('Interim result:', result.text);
    if (!result.isInterim) {
      console.log('Final result:', result.text);
    }
  },
  (error) => {
    console.error('Recognition error:', error);
  }
);

// Stop recognition
await speechService.stopContinuousRecognition(recognizer);
```

### Voice Command Processing

```typescript
const command = speechService.processVoiceCommand(
  'Add 2 packets of rice to my cart',
  'en-US'
);

console.log('Intent:', command.intent); // 'order'
console.log('Product:', command.entities.productName); // 'rice'
console.log('Quantity:', command.entities.quantity); // 2
```

## Language Support

### AWS Transcribe Supported Languages
- English (US): `en-US`
- Hindi: `hi-IN`
- Tamil: `ta-IN`
- Telugu: `te-IN`
- Kannada: `kn-IN`
- Malayalam: `ml-IN`
- Gujarati: `gu-IN`
- Marathi: `mr-IN`
- Bengali: `bn-IN`
- Punjabi: `pa-IN`
- Urdu: `ur-IN`

### AWS Polly Supported Voices

#### English (US)
- Joanna (Neural, Female)
- Matthew (Neural, Male)
- Ivy (Neural, Female)
- Justin (Neural, Male)

#### Hindi (India)
- Aditi (Standard, Female)
- Kajal (Neural, Female)

#### Other Indian Languages
- Tamil: Lekha (Standard, Female)
- Telugu: Lekha (Standard, Female)

## Advanced Features

### Custom Voice Selection

```typescript
// Get available voices for a language
const voices = await speechService.getVoiceInfo('hi-IN');
voices.forEach(voice => {
  console.log(`${voice.name} (${voice.provider})`);
});

// Use specific voice
const result = await speechService.textToSpeech(
  'नमस्ते, दुकानों में आपका स्वागत है!',
  'hi-IN',
  'Kajal'
);
```

### Batch Processing

```typescript
import AWSTranscribeService from '../services/awsAI/transcribeService';

// Process multiple audio files
const audioFiles = ['audio1.wav', 'audio2.wav', 'audio3.wav'];
const results = await Promise.all(
  audioFiles.map(file => 
    AWSTranscribeService.speechToText(file, 'en-US')
  )
);
```

### Cost Optimization

```typescript
// Use standard engine for cost savings
const speechService = getUnifiedSpeechService({
  preferredProvider: 'aws'
});

// Configure Polly for cost optimization
const result = await speechService.textToSpeech(
  'Hello world',
  'en-US',
  'Joanna' // Use standard voice instead of neural
);
```

## Error Handling

```typescript
try {
  const result = await speechService.speechToText(audioUri, 'en-US');
  console.log('Success:', result.text);
} catch (error) {
  if (error.message.includes('Both speech providers failed')) {
    console.error('All providers failed:', error);
    // Handle complete failure
  } else {
    console.error('Single provider failed:', error);
    // Fallback should have been attempted
  }
}
```

## Performance Comparison

| Feature | Azure Speech | AWS Transcribe/Polly | Notes |
|---------|--------------|---------------------|-------|
| Real-time STT | ✅ Excellent | ✅ Good | Azure has lower latency |
| Batch STT | ✅ Good | ✅ Excellent | AWS better for large files |
| TTS Quality | ✅ Very Good | ✅ Excellent | AWS Neural voices superior |
| Indian Languages | ✅ Excellent | ⚠️ Limited | Azure has better coverage |
| Cost | 💰 Moderate | 💰 Lower | AWS generally cheaper |
| Setup Complexity | 🔧 Simple | 🔧 Moderate | AWS requires S3 setup |

## Troubleshooting

### Common Issues

1. **AWS Credentials Error**
   ```
   Error: Unable to locate credentials
   ```
   - Verify AWS credentials in environment variables
   - Check IAM permissions
   - Ensure credentials are not expired

2. **S3 Bucket Access Error**
   ```
   Error: Access Denied
   ```
   - Verify bucket exists and is accessible
   - Check S3 permissions in IAM policy
   - Ensure bucket is in the same region

3. **Transcribe Job Failed**
   ```
   Error: Invalid audio format
   ```
   - Ensure audio file is in supported format (WAV, MP3, MP4, FLAC)
   - Check audio file size limits
   - Verify audio quality and duration

4. **Polly Synthesis Failed**
   ```
   Error: Invalid voice ID
   ```
   - Check if voice is available for the language
   - Verify voice ID spelling
   - Ensure neural engine is available in your region

### Debug Mode

```typescript
// Enable debug logging
const speechService = getUnifiedSpeechService({
  preferredProvider: 'aws',
  fallbackEnabled: true
});

// Check service status
console.log('Current provider:', speechService.getCurrentProvider());
console.log('Supported languages:', speechService.getSupportedLanguages());
```

## Migration from Azure-only

If you're migrating from Azure-only implementation:

1. **Update imports**:
   ```typescript
   // Old
   import AzureSpeechService from '../services/azureAI/speechService';
   
   // New
   import { getUnifiedSpeechService } from '../services/speechService';
   const speechService = getUnifiedSpeechService();
   ```

2. **Update method calls**:
   ```typescript
   // Old
   const result = await AzureSpeechService.speechToText('en-US');
   
   // New
   const result = await speechService.speechToText(undefined, 'en-US');
   ```

3. **Handle provider-specific results**:
   ```typescript
   const result = await speechService.speechToText(audioUri, 'en-US');
   console.log(`Transcribed by ${result.provider}: ${result.text}`);
   ```

## Best Practices

1. **Provider Selection**:
   - Use Azure for real-time applications
   - Use AWS for batch processing and high-quality TTS
   - Enable fallback for production reliability

2. **Cost Management**:
   - Monitor usage through AWS CloudWatch
   - Use standard voices when neural quality isn't required
   - Implement caching for frequently used TTS

3. **Performance**:
   - Pre-warm services during app initialization
   - Use appropriate audio formats and quality
   - Implement proper error handling and retries

4. **Security**:
   - Use IAM roles instead of access keys when possible
   - Rotate credentials regularly
   - Implement proper access controls

## Support

For issues related to:
- **AWS Services**: Check AWS documentation and CloudWatch logs
- **Azure Services**: Check Azure portal and diagnostic logs
- **Integration**: Review application logs and error messages

## Future Enhancements

- [ ] Support for Google Cloud Speech-to-Text
- [ ] Real-time streaming for AWS Transcribe
- [ ] Voice cloning with AWS Polly
- [ ] Advanced intent recognition
- [ ] Multi-modal speech processing
- [ ] Edge deployment support