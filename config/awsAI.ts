// AWS AI Configuration
// Note: AWS SDK imports removed for React Native compatibility

export const AWS_AI_CONFIG = {
  // AWS Credentials
  accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
  region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
  
  // AWS Transcribe Configuration
  transcribe: {
    languageCode: 'en-US',
    mediaFormat: 'wav',
    mediaSampleRateHertz: 16000,
    vocabularyName: undefined, // Optional: custom vocabulary
    vocabularyFilterName: undefined, // Optional: profanity filter
    enableChannelIdentification: false,
    enablePartialResultsStabilization: true,
    partialResultsStability: 'medium' as 'low' | 'medium' | 'high',
    contentRedactionType: undefined, // Optional: 'PII'
    piiEntityTypes: [], // Optional: ['BANK_ACCOUNT_NUMBER', 'CREDIT_DEBIT_NUMBER', etc.]
    maxSpeakerLabels: 2,
    showSpeakerLabels: false,
    enableAutomaticPunctuation: true,
    timeout: 30000, // 30 seconds
  },
  
  // AWS Polly Configuration
  polly: {
    voiceId: 'Joanna', // Default voice
    outputFormat: 'mp3' as 'json' | 'mp3' | 'ogg_vorbis' | 'pcm',
    sampleRate: '22050',
    textType: 'text' as 'ssml' | 'text',
    engine: 'neural' as 'standard' | 'neural',
    languageCode: 'en-US',
    lexiconNames: [], // Optional: pronunciation lexicons
    speechMarkTypes: [], // Optional: ['sentence', 'ssml', 'viseme', 'word']
    timeout: 30000, // 30 seconds
  },
  
  // AWS Translate Configuration
  translate: {
    sourceLanguageCode: 'auto', // Auto-detect source language
    targetLanguageCode: 'en', // Default target language
    timeout: 30000, // 30 seconds
    maxTextLength: 5000, // Maximum characters per request
    enableCaching: true,
    cacheExpiryHours: 24,
    enableBatchTranslation: true,
    maxBatchSize: 25, // Maximum texts per batch request
    enableLanguageDetection: true,
    confidenceThreshold: 0.7, // Minimum confidence for language detection
    enableProfanityFilter: false,
    enableFormality: false, // Available for certain language pairs
    settings: {
      Profanity: 'MASK', // MASK, REMOVE, or IGNORE
      Formality: 'FORMAL' // FORMAL or INFORMAL (when supported)
    }
  },
  
  // Language Support Configuration
  supportedLanguages: {
    'en-US': {
      transcribe: 'en-US',
      polly: 'en-US',
      voices: ['Joanna', 'Matthew', 'Ivy', 'Justin', 'Kendra', 'Kimberly', 'Salli']
    },
    'hi-IN': {
      transcribe: 'hi-IN',
      polly: 'hi-IN',
      voices: ['Aditi', 'Raveena']
    },
    'ta-IN': {
      transcribe: 'ta-IN',
      polly: undefined, // Polly doesn't support Tamil
      voices: []
    },
    'te-IN': {
      transcribe: 'te-IN',
      polly: undefined, // Polly doesn't support Telugu
      voices: []
    },
    'kn-IN': {
      transcribe: 'kn-IN',
      polly: undefined, // Polly doesn't support Kannada
      voices: []
    },
    'ml-IN': {
      transcribe: 'ml-IN',
      polly: undefined, // Polly doesn't support Malayalam
      voices: []
    },
    'gu-IN': {
      transcribe: 'gu-IN',
      polly: undefined, // Polly doesn't support Gujarati
      voices: []
    },
    'mr-IN': {
      transcribe: 'mr-IN',
      polly: undefined, // Polly doesn't support Marathi
      voices: []
    },
    'bn-IN': {
      transcribe: 'bn-IN',
      polly: undefined, // Polly doesn't support Bengali
      voices: []
    },
    'pa-IN': {
      transcribe: 'pa-IN',
      polly: undefined, // Polly doesn't support Punjabi
      voices: []
    },
    'ur-IN': {
      transcribe: 'ur-IN',
      polly: undefined, // Polly doesn't support Urdu
      voices: []
    }
  },
  
  // Cost Optimization
  costOptimization: {
    enableCaching: true,
    cacheExpiryHours: 24,
    enableCompression: true,
    maxConcurrentRequests: 5,
    retryAttempts: 3,
    retryDelay: 1000, // milliseconds
  },
  
  // Performance Settings
  performance: {
    streamingEnabled: true,
    chunkSize: 8192, // bytes
    bufferSize: 16384, // bytes
    enableWebSocket: false, // For real-time streaming
  }
};

// Helper function to validate AWS configuration
export const validateAWSConfig = (): { isValid: boolean; missingKeys: string[] } => {
  const requiredKeys = [
    'EXPO_PUBLIC_AWS_ACCESS_KEY_ID',
    'EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY',
    'EXPO_PUBLIC_AWS_REGION'
  ];
  
  const missingKeys = requiredKeys.filter(key => !process.env[key]);
  
  return {
    isValid: missingKeys.length === 0,
    missingKeys
  };
};

// Configuration validation with warnings (similar to Azure pattern)
const validateConfiguration = () => {
  if (!AWS_AI_CONFIG.accessKeyId) {
    console.warn('AWS Access Key ID not configured');
  }
  if (!AWS_AI_CONFIG.secretAccessKey) {
    console.warn('AWS Secret Access Key not configured');
  }
  if (!AWS_AI_CONFIG.region) {
    console.warn('AWS Region not configured');
  }
};

// Initialize validation
validateConfiguration();

// Environment variables template for .env file
export const AWS_ENV_TEMPLATE = `
# AWS AI Configuration
# Add these to your .env file
# Note: EXPO_PUBLIC_ prefix is required for client-side access in React Native/Expo

# AWS Credentials
EXPO_PUBLIC_AWS_ACCESS_KEY_ID=your_access_key_id_here
EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
EXPO_PUBLIC_AWS_REGION=us-east-1

# AWS Service Specific Settings
EXPO_PUBLIC_AWS_TRANSCRIBE_LANGUAGE_CODE=en-US
EXPO_PUBLIC_AWS_POLLY_VOICE_ID=Joanna
EXPO_PUBLIC_AWS_POLLY_ENGINE=neural
`;

// Helper function to get voice for language
export const getVoiceForLanguage = (languageCode: string, gender: 'male' | 'female' = 'female'): string => {
  const langConfig = AWS_AI_CONFIG.supportedLanguages[languageCode];
  if (!langConfig || !langConfig.voices.length) {
    return AWS_AI_CONFIG.polly.voiceId; // Default voice
  }
  
  // Simple gender-based voice selection (this is a basic implementation)
  const voices = langConfig.voices;
  if (gender === 'female') {
    return voices.find(v => ['Joanna', 'Ivy', 'Kendra', 'Kimberly', 'Salli', 'Aditi', 'Raveena'].includes(v)) || voices[0];
  } else {
    return voices.find(v => ['Matthew', 'Justin'].includes(v)) || voices[0];
  }
};

// Helper function to check if language is supported by service
export const isLanguageSupported = (languageCode: string, service: 'transcribe' | 'polly'): boolean => {
  const langConfig = AWS_AI_CONFIG.supportedLanguages[languageCode];
  if (!langConfig) return false;
  
  if (service === 'transcribe') return !!langConfig.transcribe;
  if (service === 'polly') return !!langConfig.polly;
  
  return false;
};

// Development environment validation (simplified)
if (process.env.NODE_ENV === 'development') {
  const { isValid, missingKeys } = validateAWSConfig();
  if (!isValid) {
    console.warn('AWS AI Configuration: Missing environment variables:', missingKeys.join(', '));
  }
}

// Production environment validation
if (process.env.NODE_ENV === 'production') {
  const { isValid, missingKeys } = validateAWSConfig();
  if (!isValid) {
    throw new Error(`AWS AI Configuration Error: Missing required environment variables: ${missingKeys.join(', ')}`);
  }
}

export default AWS_AI_CONFIG;