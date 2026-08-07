import { useState, useEffect, useRef } from 'react';
import { translationService, SupportedLanguage } from '../services/translationService';
import { useLanguage } from '../contexts/LanguageContext';

// Polyfill for Promise.allSettled (not available in Hermes/older environments)
const promiseAllSettled = <T,>(promises: Promise<T>[]): Promise<PromiseSettledResult<T>[]> => {
    if (Promise.allSettled) {
        return Promise.allSettled(promises);
    }
    // Fallback implementation
    return Promise.all(
        promises.map((promise) =>
            Promise.resolve(promise)
                .then((value) => ({ status: 'fulfilled' as const, value }))
                .catch((reason) => ({ status: 'rejected' as const, reason }))
        )
    );
};

/**
 * Hook for instant translations with fallback to async loading
 * 
 * This hook provides a cache-first approach to translations:
 * 1. Returns English text immediately (no waiting)
 * 2. Checks cache synchronously for instant translated text
 * 3. Only makes API calls if not cached, updating state when done
 * 
 * Usage:
 * const { t, isLoading } = useInstantTranslation({
 *   welcome: 'Welcome',
 *   login: 'Login',
 * });
 * 
 * // In JSX: {t.welcome} - will show cached translation or English immediately
 */
export function useInstantTranslation<T extends Record<string, string>>(
    originalTexts: T
): { t: T; isLoading: boolean } {
    const { currentLanguage, isLanguageReady } = useLanguage();
    const [translations, setTranslations] = useState<T>(originalTexts);
    const [isLoading, setIsLoading] = useState(false);
    const isMountedRef = useRef(true);
    const requestIdRef = useRef(0);
    // Track the last language we successfully translated to
    const lastTranslatedLanguageRef = useRef<string>('en');

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        console.log(`[useInstantTranslation] Effect triggered: language=${currentLanguage}, isLanguageReady=${isLanguageReady}, lastTranslated=${lastTranslatedLanguageRef.current}`);

        // Don't do anything if language context isn't ready
        if (!isLanguageReady) {
            console.log('[useInstantTranslation] Language not ready yet, waiting...');
            return;
        }

        // If language hasn't changed from our last translation, no need to re-translate
        if (lastTranslatedLanguageRef.current === currentLanguage) {
            console.log(`[useInstantTranslation] Already translated to ${currentLanguage}, skipping`);
            return;
        }

        // For English, just use original texts
        if (currentLanguage === 'en') {
            console.log('[useInstantTranslation] Language is English, using original texts');
            setTranslations(originalTexts);
            lastTranslatedLanguageRef.current = 'en';
            return;
        }

        const currentRequestId = ++requestIdRef.current;

        // Step 1: Check cache synchronously for instant display
        const cachedTranslations: Record<string, string> = {};
        const uncachedKeys: string[] = [];

        for (const [key, value] of Object.entries(originalTexts)) {
            const cached = translationService.getCachedTranslationSync(value, currentLanguage as SupportedLanguage);
            if (cached) {
                cachedTranslations[key] = cached;
                console.log(`[useInstantTranslation] Cache hit for "${key}": "${value}" -> "${cached}"`);
            } else {
                cachedTranslations[key] = value; // Use original as fallback
                uncachedKeys.push(key);
                console.log(`[useInstantTranslation] Cache miss for "${key}": "${value}"`);
            }
        }

        console.log(`[useInstantTranslation] Cached: ${Object.keys(originalTexts).length - uncachedKeys.length}, Uncached: ${uncachedKeys.length}`);

        // Set cached translations immediately
        if (isMountedRef.current && currentRequestId === requestIdRef.current) {
            setTranslations(cachedTranslations as T);
            // If everything was cached, mark as complete
            if (uncachedKeys.length === 0) {
                lastTranslatedLanguageRef.current = currentLanguage;
                console.log('[useInstantTranslation] All translations were cached');
                return;
            }
        }

        // Step 2: Load uncached translations (no delay - do it immediately)
        const loadUncached = async () => {
            setIsLoading(true);

            try {
                // Collect texts to translate
                const textsToTranslate = uncachedKeys.map(key => originalTexts[key]);
                console.log(`[useInstantTranslation] Fetching translations for ${textsToTranslate.length} texts to ${currentLanguage}...`);

                // Single batch API call for all uncached texts
                const results = await translationService.translateBatch(
                    textsToTranslate,
                    currentLanguage as SupportedLanguage
                );

                if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
                    console.log('[useInstantTranslation] Request outdated, discarding results');
                    return;
                }

                // Merge newly translated texts
                const newTranslations = { ...cachedTranslations };
                uncachedKeys.forEach((key, i) => {
                    newTranslations[key] = results[i]?.translatedText || originalTexts[key];
                    console.log(`[useInstantTranslation] Translated "${key}": "${originalTexts[key]}" -> "${newTranslations[key]}"`);
                });

                console.log(`[useInstantTranslation] Applied ${uncachedKeys.length} translations to ${currentLanguage}`);
                setTranslations(newTranslations as T);
                lastTranslatedLanguageRef.current = currentLanguage;
            } catch (error) {
                console.error('[useInstantTranslation] Error loading translations:', error);
            } finally {
                if (isMountedRef.current && currentRequestId === requestIdRef.current) {
                    setIsLoading(false);
                }
            }
        };

        // Start loading immediately (no delay)
        loadUncached();

        return () => {
            // Cleanup - mark request as outdated
        };
    }, [currentLanguage, isLanguageReady, JSON.stringify(originalTexts)]);

    return { t: translations, isLoading };
}

/**
 * Helper to translate a single text synchronously if cached, 
 * otherwise return the original text
 */
export function getInstantTranslation(
    text: string,
    language: SupportedLanguage
): string {
    if (language === 'en') return text;
    return translationService.getCachedTranslationSync(text, language) || text;
}

export default useInstantTranslation;
