export const AZURE_AI_CONFIG = {
  // Azure AI Projects endpoint
  endpoint: 'https://nithinvthomas96-2178-resource.services.ai.azure.com/api/projects/nithinvthomas96-2178',
  
  // Agent ID from Azure OpenAI Assistants API
  agentId: 'asst_glGt0W6dgYceucgr24x6SPaF',
  
  // Polling interval for run status (in milliseconds)
  pollingInterval: 1000,
  
  // Maximum polling attempts
  maxPollingAttempts: 60,
  
  // Request timeout (in milliseconds)
  requestTimeout: 30000,
  
  // Azure AI Projects Configuration
  apiKey: process.env.EXPO_PUBLIC_AZURE_AI_API_KEY || '',
  resourceName: process.env.EXPO_PUBLIC_AZURE_OPENAI_RESOURCE_NAME || '',
  deploymentName: process.env.EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
  apiVersion: '2024-02-15-preview',
  
  // Azure Speech Services Configuration
  speechKey: process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY || 'BoAylDHkLnHj3WloBq5loZL22t2fVCd3YPwSFtIdINazL8C4IeZ0JQQJ99BIACHYHv6XJ3w3AAAAACOGnwpd',
  speechRegion: process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION || 'eastus2',
  speechEndpoint: process.env.EXPO_PUBLIC_AZURE_SPEECH_ENDPOINT || 'https://eastus2.stt.speech.microsoft.com',
  speechTTSEndpoint: process.env.EXPO_PUBLIC_AZURE_SPEECH_TTS_ENDPOINT || 'https://eastus2.tts.speech.microsoft.com',
  
  // Azure AI Foundry Configuration
  aiFoundryEndpoint: process.env.EXPO_PUBLIC_AZURE_AI_FOUNDRY_ENDPOINT || '',
  aiServicesEndpoint: process.env.EXPO_PUBLIC_AZURE_AI_SERVICES_ENDPOINT || 'https://nithinvthomas96-2664-resource.cognitiveservices.azure.com/',
  
  // Azure Translator Configuration
  translatorKey: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_KEY || 'BoAylDHkLnHj3WloBq5loZL22t2fVCd3YPwSFtIdINazL8C4IeZ0JQQJ99BIACHYHv6XJ3w3AAAAACOGnwpd',
  translatorRegion: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_REGION || 'eastus2',
  translatorEndpoint: 'https://api.cognitive.microsofttranslator.com',
  
  // Azure Computer Vision Configuration
  computerVisionKey: process.env.EXPO_PUBLIC_AZURE_COMPUTER_VISION_KEY || 'BoAylDHkLnHj3WloBq5loZL22t2fVCd3YPwSFtIdINazL8C4IeZ0JQQJ99BIACHYHv6XJ3w3AAAAACOGnwpd',
  computerVisionRegion: process.env.EXPO_PUBLIC_AZURE_COMPUTER_VISION_REGION || 'eastus2',
  computerVisionEndpoint: process.env.EXPO_PUBLIC_AZURE_COMPUTER_VISION_ENDPOINT || 'https://nithinvthomas96-2664-resource.cognitiveservices.azure.com/',
  
  // Image Generation Settings
  imageGeneration: {
    model: 'dall-e-3',
    quality: 'standard' as 'standard' | 'hd',
    size: '1024x1024' as '256x256' | '512x512' | '1024x1024',
    style: 'natural' as 'natural' | 'vivid',
    maxRetries: 3,
    timeout: 30000, // 30 seconds
  },
  
  // Text Generation Settings
  textGeneration: {
    maxTokens: 1000,
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  
  // Speech Recognition Settings
  speechRecognition: {
    defaultLanguage: 'en-US',
    continuousRecognition: true,
    enableProfanityFilter: true,
    enableWordLevelTimestamps: false,
    timeout: 15000, // 15 seconds
  },
  
  // Speech Synthesis Settings
  speechSynthesis: {
    defaultVoice: 'en-US-JennyNeural',
    speechRate: 1.0,
    speechPitch: 1.0,
    outputFormat: 'audio-16khz-32kbitrate-mono-mp3',
  },
  
  // Translation Settings
  translation: {
    defaultSourceLanguage: 'auto',
    defaultTargetLanguage: 'en',
    enableCaching: true,
    cacheExpiryHours: 168, // 7 days
    batchSize: 100,
  },
  
  // OCR Settings
  ocr: {
    language: 'en',
    detectOrientation: true,
    enableHandwriting: true,
    timeout: 30000, // 30 seconds
  },
  
  // Cost Optimization
  costOptimization: {
    enableCaching: true,
    cacheExpiryHours: 24,
    batchSize: 10,
    enableCompression: true,
  }
};

// Helper function to validate configuration
export const validateAzureConfig = (): { isValid: boolean; missingKeys: string[] } => {
  const requiredKeys = [
    'EXPO_PUBLIC_AZURE_AI_API_KEY',
    'EXPO_PUBLIC_AZURE_OPENAI_API_KEY',
    'EXPO_PUBLIC_AZURE_SPEECH_KEY',
    'EXPO_PUBLIC_AZURE_TRANSLATOR_KEY',
    'EXPO_PUBLIC_AZURE_COMPUTER_VISION_KEY'
  ];
  
  const missingKeys = requiredKeys.filter(key => !process.env[key]);
  
  return {
    isValid: missingKeys.length === 0,
    missingKeys
  };
};

// Environment variables template for .env file
export const ENV_TEMPLATE = `
# Azure AI Configuration
# Add these to your .env file
# Note: EXPO_PUBLIC_ prefix is required for client-side access in React Native/Expo

# Azure AI Projects
EXPO_PUBLIC_AZURE_AI_API_KEY=your_ai_projects_api_key_here
EXPO_PUBLIC_AZURE_AI_ENDPOINT=your_ai_projects_endpoint_here
EXPO_PUBLIC_AZURE_AI_AGENT_ID=your_agent_id_here

# Azure OpenAI
EXPO_PUBLIC_AZURE_OPENAI_API_KEY=your_openai_api_key_here
EXPO_PUBLIC_AZURE_OPENAI_RESOURCE_NAME=your_resource_name_here
EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

# Azure Speech Services
EXPO_PUBLIC_AZURE_SPEECH_KEY=your_speech_api_key_here
EXPO_PUBLIC_AZURE_SPEECH_REGION=eastus

# Azure Translator
EXPO_PUBLIC_AZURE_TRANSLATOR_KEY=your_translator_api_key_here
EXPO_PUBLIC_AZURE_TRANSLATOR_REGION=eastus
EXPO_PUBLIC_AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com

# Azure Computer Vision
EXPO_PUBLIC_AZURE_COMPUTER_VISION_KEY=your_computer_vision_api_key_here
EXPO_PUBLIC_AZURE_COMPUTER_VISION_REGION=eastus2
EXPO_PUBLIC_AZURE_COMPUTER_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
`;

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  // Development-specific settings can be added here
}

if (process.env.NODE_ENV === 'production') {
  // Production-specific settings can be added here
}

export default AZURE_AI_CONFIG;