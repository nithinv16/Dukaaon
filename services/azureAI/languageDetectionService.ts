
interface DetectedLanguage {
  language: string;
  confidence: number;
  displayName: string;
  script?: string;
}


/**
 * Language detection for voice input.
 *
 * `detectLanguage` is entirely local — Unicode script ranges plus common-word
 * matching — so it never needed a provider credential. The former constructor
 * read AZURE_AI_CONFIG.translatorKey purely for `translateText`, which had no
 * callers; that method has been removed along with the credential fields.
 *
 * Translation now lives in services/translationService.ts, which routes through
 * the ai-translate edge function.
 */
class LanguageDetectionService {
  // Language mappings with script detection
  private readonly languageMappings = {
    // Devanagari script
    'hi': { code: 'hi-IN', name: 'Hindi', displayName: 'हिंदी (Hindi)', script: 'Devanagari' },
    'mr': { code: 'mr-IN', name: 'Marathi', displayName: 'मराठी (Marathi)', script: 'Devanagari' },
    'ne': { code: 'ne-NP', name: 'Nepali', displayName: 'नेपाली (Nepali)', script: 'Devanagari' },
    
    // Telugu script
    'te': { code: 'te-IN', name: 'Telugu', displayName: 'తెలుగు (Telugu)', script: 'Telugu' },
    
    // Tamil script
    'ta': { code: 'ta-IN', name: 'Tamil', displayName: 'தமிழ் (Tamil)', script: 'Tamil' },
    
    // Kannada script
    'kn': { code: 'kn-IN', name: 'Kannada', displayName: 'ಕನ್ನಡ (Kannada)', script: 'Kannada' },
    
    // Malayalam script
    'ml': { code: 'ml-IN', name: 'Malayalam', displayName: 'മലയാളം (Malayalam)', script: 'Malayalam' },
    
    // Bengali script
    'bn': { code: 'bn-IN', name: 'Bengali', displayName: 'বাংলা (Bengali)', script: 'Bengali' },
    
    // Gujarati script
    'gu': { code: 'gu-IN', name: 'Gujarati', displayName: 'ગુજરાતી (Gujarati)', script: 'Gujarati' },
    
    // Gurmukhi script (Punjabi)
    'pa': { code: 'pa-IN', name: 'Punjabi', displayName: 'ਪੰਜਾਬੀ (Punjabi)', script: 'Gurmukhi' },
    
    // Odia script
    'or': { code: 'or-IN', name: 'Odia', displayName: 'ଓଡ଼ିଆ (Odia)', script: 'Odia' },
    
    // Assamese script
    'as': { code: 'as-IN', name: 'Assamese', displayName: 'অসমীয়া (Assamese)', script: 'Bengali' },
    
    // Urdu script
    'ur': { code: 'ur-PK', name: 'Urdu', displayName: 'اردو (Urdu)', script: 'Arabic' },
    
    // Latin script
    'en': { code: 'en-US', name: 'English', displayName: 'English (US)', script: 'Latin' },
  };

  // Script Unicode ranges
  private readonly scriptRanges = {
    Devanagari: /[\u0900-\u097F]/,
    Telugu: /[\u0C00-\u0C7F]/,
    Tamil: /[\u0B80-\u0BFF]/,
    Kannada: /[\u0C80-\u0CFF]/,
    Malayalam: /[\u0D00-\u0D7F]/,
    Bengali: /[\u0980-\u09FF]/,
    Gujarati: /[\u0A80-\u0AFF]/,
    Gurmukhi: /[\u0A00-\u0A7F]/,
    Odia: /[\u0B00-\u0B7F]/,
    Arabic: /[\u0600-\u06FF\u0750-\u077F]/,
    Latin: /[\u0000-\u007F\u0080-\u00FF\u0100-\u017F]/,
  };

  // Common words for language identification
  private readonly commonWords = {
    'hi': ['है', 'हैं', 'का', 'की', 'के', 'में', 'से', 'को', 'पर', 'और', 'या', 'नहीं', 'यह', 'वह', 'मैं', 'तुम', 'आप'],
    'te': ['ఉంది', 'ఉన్నాయి', 'యొక్క', 'లో', 'నుండి', 'కు', 'పై', 'మరియు', 'లేదా', 'కాదు', 'ఇది', 'అది', 'నేను', 'నువ్వు', 'మీరు'],
    'ta': ['உள்ளது', 'உள்ளன', 'இன்', 'இல்', 'இருந்து', 'க்கு', 'மேல்', 'மற்றும்', 'அல்லது', 'இல்லை', 'இது', 'அது', 'நான்', 'நீ', 'நீங்கள்'],
    'kn': ['ಇದೆ', 'ಇವೆ', 'ಅ', 'ಇನ್', 'ಇಂದ', 'ಗೆ', 'ಮೇಲೆ', 'ಮತ್ತು', 'ಅಥವಾ', 'ಇಲ್ಲ', 'ಇದು', 'ಅದು', 'ನಾನು', 'ನೀನು', 'ನೀವು'],
    'ml': ['ഉണ്ട്', 'ഉണ്ട്', 'ന്റെ', 'ൽ', 'ൽ നിന്ന്', 'ക്ക്', 'മേൽ', 'ഒപ്പം', 'അല്ലെങ്കിൽ', 'ഇല്ല', 'ഇത്', 'അത്', 'ഞാൻ', 'നീ', 'നിങ്ങൾ'],
    'bn': ['আছে', 'আছেন', 'এর', 'এ', 'থেকে', 'কে', 'উপর', 'এবং', 'অথবা', 'না', 'এটি', 'ওটি', 'আমি', 'তুমি', 'আপনি'],
    'gu': ['છે', 'છે', 'ના', 'માં', 'થી', 'ને', 'પર', 'અને', 'અથવા', 'નથી', 'આ', 'તે', 'હું', 'તું', 'તમે'],
    'pa': ['ਹੈ', 'ਹਨ', 'ਦਾ', 'ਵਿੱਚ', 'ਤੋਂ', 'ਨੂੰ', 'ਉੱਤੇ', 'ਅਤੇ', 'ਜਾਂ', 'ਨਹੀਂ', 'ਇਹ', 'ਉਹ', 'ਮੈਂ', 'ਤੂੰ', 'ਤੁਸੀਂ'],
    'mr': ['आहे', 'आहेत', 'चा', 'मध्ये', 'पासून', 'ला', 'वर', 'आणि', 'किंवा', 'नाही', 'हे', 'ते', 'मी', 'तू', 'तुम्ही'],
    'or': ['ଅଛି', 'ଅଛନ୍ତି', 'ର', 'ରେ', 'ରୁ', 'କୁ', 'ଉପରେ', 'ଏବଂ', 'କିମ୍ବା', 'ନାହିଁ', 'ଏହା', 'ତାହା', 'ମୁଁ', 'ତୁ', 'ଆପଣ'],
    'as': ['আছে', 'আছে', 'ৰ', 'ত', 'ৰ পৰা', 'ক', 'ওপৰত', 'আৰু', 'বা', 'নাই', 'এইটো', 'সেইটো', 'মই', 'তুমি', 'আপুনি'],
    'ur': ['ہے', 'ہیں', 'کا', 'میں', 'سے', 'کو', 'پر', 'اور', 'یا', 'نہیں', 'یہ', 'وہ', 'میں', 'تم', 'آپ'],
    'en': ['is', 'are', 'of', 'in', 'from', 'to', 'on', 'and', 'or', 'not', 'this', 'that', 'i', 'you', 'we']
  };

  /**
   * Detect language from text using script analysis and common words
   */
  async detectLanguage(text: string): Promise<DetectedLanguage[]> {
    if (!text || text.trim().length === 0) {
      return [{
        language: 'en-US',
        confidence: 0.5,
        displayName: 'English (US)',
        script: 'Latin'
      }];
    }

    const detectedLanguages: DetectedLanguage[] = [];
    const cleanText = text.toLowerCase().trim();

    // First, detect script
    const detectedScript = this.detectScript(text);
    
    // Then, use common words to refine language detection
    const languageScores: { [key: string]: number } = {};

    // Score based on script
    Object.entries(this.languageMappings).forEach(([langCode, langInfo]) => {
      if (langInfo.script === detectedScript) {
        languageScores[langCode] = 0.3; // Base score for script match
      }
    });

    // Score based on common words
    Object.entries(this.commonWords).forEach(([langCode, words]) => {
      const wordMatches = words.filter(word => 
        cleanText.includes(word.toLowerCase())
      ).length;
      
      if (wordMatches > 0) {
        languageScores[langCode] = (languageScores[langCode] || 0) + 
          (wordMatches / words.length) * 0.7;
      }
    });

    // Convert scores to detected languages
    Object.entries(languageScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3) // Top 3 candidates
      .forEach(([langCode, score]) => {
        const langInfo = this.languageMappings[langCode as keyof typeof this.languageMappings];
        if (langInfo && score > 0.2) {
          detectedLanguages.push({
            language: langInfo.code,
            confidence: Math.min(score, 0.95),
            displayName: langInfo.displayName,
            script: langInfo.script
          });
        }
      });

    // Fallback to English if no language detected
    if (detectedLanguages.length === 0) {
      detectedLanguages.push({
        language: 'en-US',
        confidence: 0.6,
        displayName: 'English (US)',
        script: 'Latin'
      });
    }

    return detectedLanguages;
  }

  /**
   * Detect script from text
   */
  private detectScript(text: string): string {
    for (const [script, regex] of Object.entries(this.scriptRanges)) {
      if (regex.test(text)) {
        return script;
      }
    }
    return 'Latin'; // Default to Latin script
  }

  /**
   * Get language info by code
   */
  getLanguageInfo(languageCode: string) {
    const shortCode = languageCode.split('-')[0];
    return this.languageMappings[shortCode as keyof typeof this.languageMappings];
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages() {
    return Object.values(this.languageMappings);
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(languageCode: string): boolean {
    const shortCode = languageCode.split('-')[0];
    return shortCode in this.languageMappings;
  }
}

export default new LanguageDetectionService();
export type { DetectedLanguage };