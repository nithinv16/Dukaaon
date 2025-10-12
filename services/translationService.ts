import AsyncStorage from '@react-native-async-storage/async-storage';

// Supported languages
export type SupportedLanguage = 'en' | 'hi' | 'ml' | 'ta' | 'te' | 'kn' | 'mr' | 'bn';

// Translation result interface
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
}

// Translation cache entry
interface CacheEntry {
  text: string;
  timestamp: number;
  confidence?: number;
}

// Translation cache structure
interface TranslationCache {
  [sourceText: string]: {
    [targetLang: string]: CacheEntry;
  };
}

// Azure Translator configuration
const AZURE_CONFIG = {
  key: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_KEY || 'BoAylDHkLnHj3WloBq5loZL22t2fVCd3YPwSFtIdINazL8C4IeZ0JQQJ99BIACHYHv6XJ3w3AAAAACOGnwpd',
  region: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_REGION || 'eastus2',
  endpoint: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com',
};

// Cache configuration
const CACHE_CONFIG = {
  maxEntries: 1000,
  expiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  storageKey: 'azure_translation_cache',
};

class TranslationService {
  private cache: TranslationCache = {};
  private isInitialized = false;

  /**
   * Initialize the translation service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadCache();
      this.isInitialized = true;
      console.log('TranslationService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TranslationService:', error);
      throw error;
    }
  }

  /**
   * Load translation cache from AsyncStorage
   */
  private async loadCache(): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_CONFIG.storageKey);
      if (cacheData) {
        const parsedCache = JSON.parse(cacheData);
        // Clean expired entries
        this.cache = this.cleanExpiredEntries(parsedCache);
      }
    } catch (error) {
      console.error('Error loading translation cache:', error);
      this.cache = {};
    }
  }

  /**
   * Save translation cache to AsyncStorage
   */
  private async saveCache(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_CONFIG.storageKey, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Error saving translation cache:', error);
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredEntries(cache: TranslationCache): TranslationCache {
    const now = Date.now();
    const cleanedCache: TranslationCache = {};

    for (const [sourceText, translations] of Object.entries(cache)) {
      const validTranslations: { [key: string]: CacheEntry } = {};
      
      for (const [lang, entry] of Object.entries(translations)) {
        if (now - entry.timestamp < CACHE_CONFIG.expiryMs) {
          validTranslations[lang] = entry;
        }
      }

      if (Object.keys(validTranslations).length > 0) {
        cleanedCache[sourceText] = validTranslations;
      }
    }

    return cleanedCache;
  }

  /**
   * Get cached translation
   */
  private getCachedTranslation(text: string, targetLanguage: SupportedLanguage): string | null {
    const cacheKey = text.toLowerCase().trim();
    const cached = this.cache[cacheKey]?.[targetLanguage];
    
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.expiryMs) {
      return cached.text;
    }
    
    return null;
  }

  /**
   * Cache translation result
   */
  private setCachedTranslation(
    text: string, 
    targetLanguage: SupportedLanguage, 
    translatedText: string,
    confidence?: number
  ): void {
    const cacheKey = text.toLowerCase().trim();
    
    if (!this.cache[cacheKey]) {
      this.cache[cacheKey] = {};
    }
    
    this.cache[cacheKey][targetLanguage] = {
      text: translatedText,
      timestamp: Date.now(),
      confidence,
    };

    // Limit cache size
    this.limitCacheSize();
    
    // Save to storage (async, don't wait)
    this.saveCache().catch(console.error);
  }

  /**
   * Limit cache size to prevent memory issues
   */
  private limitCacheSize(): void {
    const entries = Object.entries(this.cache);
    if (entries.length > CACHE_CONFIG.maxEntries) {
      // Remove oldest entries
      const sortedEntries = entries.sort((a, b) => {
        const aTime = Math.min(...Object.values(a[1]).map(entry => entry.timestamp));
        const bTime = Math.min(...Object.values(b[1]).map(entry => entry.timestamp));
        return aTime - bTime;
      });

      const entriesToKeep = sortedEntries.slice(-CACHE_CONFIG.maxEntries);
      this.cache = Object.fromEntries(entriesToKeep);
    }
  }

  /**
   * Translate text using Azure Translator
   */
  async translateText(
    text: string, 
    targetLanguage: SupportedLanguage,
    sourceLanguage: SupportedLanguage = 'en'
  ): Promise<TranslationResult> {
    // Ensure service is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Return original text if target is same as source or text is empty
    if (targetLanguage === sourceLanguage || !text.trim()) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        confidence: 1.0,
      };
    }

    // Check cache first
    const cachedResult = this.getCachedTranslation(text, targetLanguage);
    if (cachedResult) {
      return {
        originalText: text,
        translatedText: cachedResult,
        sourceLanguage,
        targetLanguage,
        confidence: 1.0, // Cached results are considered reliable
      };
    }

    try {
      // Call Azure Translator API
      const translatedText = await this.callAzureTranslator(text, targetLanguage, sourceLanguage);
      
      // Cache the result
      this.setCachedTranslation(text, targetLanguage, translatedText);

      return {
        originalText: text,
        translatedText,
        sourceLanguage,
        targetLanguage,
        confidence: 0.9, // High confidence for Azure translations
      };
    } catch (error) {
      console.error('Translation failed:', error);
      
      // Return original text on error
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        confidence: 0.0,
      };
    }
  }

  /**
   * Call Azure Translator API
   */
  private async callAzureTranslator(
    text: string, 
    targetLanguage: SupportedLanguage,
    sourceLanguage: SupportedLanguage = 'en'
  ): Promise<string> {
    if (!AZURE_CONFIG.key) {
      throw new Error('Azure Translator API key not configured');
    }

    const url = `${AZURE_CONFIG.endpoint}/translate?api-version=3.0&from=${sourceLanguage}&to=${targetLanguage}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_CONFIG.key,
        'Ocp-Apim-Subscription-Region': AZURE_CONFIG.region,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ text }]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure Translator API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (!result || !result[0] || !result[0].translations || !result[0].translations[0]) {
      throw new Error('Invalid response from Azure Translator API');
    }

    return result[0].translations[0].text;
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(
    texts: string[], 
    targetLanguage: SupportedLanguage,
    sourceLanguage: SupportedLanguage = 'en'
  ): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];
    
    // Process in chunks to avoid API limits
    const chunkSize = 10;
    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(text => this.translateText(text, targetLanguage, sourceLanguage))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
    if (!AZURE_CONFIG.key) {
      throw new Error('Azure Translator API key not configured');
    }

    const url = `${AZURE_CONFIG.endpoint}/detect?api-version=3.0`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_CONFIG.key,
          'Ocp-Apim-Subscription-Region': AZURE_CONFIG.region,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ text }]),
      });

      if (!response.ok) {
        throw new Error(`Language detection failed: ${response.statusText}`);
      }

      const result = await response.json();
      const detection = result[0];

      return {
        language: detection.language,
        confidence: detection.score,
      };
    } catch (error) {
      console.error('Language detection error:', error);
      return {
        language: 'en',
        confidence: 0.0,
      };
    }
  }

  /**
   * Clear translation cache
   */
  async clearCache(): Promise<void> {
    try {
      this.cache = {};
      await AsyncStorage.removeItem(CACHE_CONFIG.storageKey);
      console.log('Translation cache cleared');
    } catch (error) {
      console.error('Error clearing translation cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalEntries: number; totalTranslations: number; cacheSize: string } {
    const totalEntries = Object.keys(this.cache).length;
    let totalTranslations = 0;
    
    for (const translations of Object.values(this.cache)) {
      totalTranslations += Object.keys(translations).length;
    }

    const cacheSize = JSON.stringify(this.cache).length;
    const cacheSizeKB = (cacheSize / 1024).toFixed(2);

    return {
      totalEntries,
      totalTranslations,
      cacheSize: `${cacheSizeKB} KB`,
    };
  }
}

// Export singleton instance
export const translationService = new TranslationService();

// Export class for testing
export { TranslationService };

// Export default
export default translationService;