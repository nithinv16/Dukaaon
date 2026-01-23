/**
 * Install Referrer Service
 * Handles Google Play Install Referrer for deferred deep linking
 * 
 * This allows tracking referrals even when:
 * 1. User clicks referral link
 * 2. Gets redirected to Play Store
 * 3. Downloads and installs the app
 * 4. Opens the app for the first time
 * 
 * The referral data is preserved through the entire journey!
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules, Linking } from 'react-native';

const INSTALL_REFERRER_KEY = 'install_referrer_data';
const INSTALL_REFERRER_PROCESSED_KEY = 'install_referrer_processed';

export interface InstallReferrerData {
    referralCode: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    installReferrer: string | null;
    referrerClickTimestamp: number | null;
    installBeginTimestamp: number | null;
    salesTeamCode: string | null;
}

class InstallReferrerService {
    private cachedReferrer: InstallReferrerData | null = null;

    /**
     * Check and retrieve install referrer data
     * This should be called on app startup (first launch)
     */
    async getInstallReferrer(): Promise<InstallReferrerData | null> {
        try {
            // Check if already processed
            const processed = await AsyncStorage.getItem(INSTALL_REFERRER_PROCESSED_KEY);
            if (processed === 'true') {
                // Return cached data if available
                const cached = await AsyncStorage.getItem(INSTALL_REFERRER_KEY);
                return cached ? JSON.parse(cached) : null;
            }

            // Only works on Android
            if (Platform.OS !== 'android') {
                console.log('[InstallReferrer] Not on Android, skipping');
                return null;
            }

            let referrerData: InstallReferrerData = {
                referralCode: null,
                utmSource: null,
                utmMedium: null,
                utmCampaign: null,
                utmContent: null,
                installReferrer: null,
                referrerClickTimestamp: null,
                installBeginTimestamp: null,
                salesTeamCode: null,
            };

            // Try to get referrer from native module if available
            try {
                // Check if react-native-android-installed-apps-unblocking or similar is available
                if (NativeModules.RNInstallReferrer) {
                    const result = await NativeModules.RNInstallReferrer.getInstallReferrer();
                    if (result && result.installReferrer) {
                        referrerData = this.parseReferrerString(result.installReferrer);
                        referrerData.referrerClickTimestamp = result.referrerClickTimestampSeconds;
                        referrerData.installBeginTimestamp = result.installBeginTimestampSeconds;
                    }
                }
            } catch (nativeError) {
                console.log('[InstallReferrer] Native module not available:', nativeError);
            }

            // Fallback: Check initial URL (for direct deep links)
            try {
                const initialUrl = await Linking.getInitialURL();
                if (initialUrl) {
                    const urlReferrer = this.parseDeepLinkUrl(initialUrl);
                    if (urlReferrer.referralCode) {
                        referrerData = { ...referrerData, ...urlReferrer };
                    }
                }
            } catch (urlError) {
                console.log('[InstallReferrer] Error getting initial URL:', urlError);
            }

            // Store the referrer data
            if (referrerData.referralCode || referrerData.installReferrer) {
                await AsyncStorage.setItem(INSTALL_REFERRER_KEY, JSON.stringify(referrerData));
                console.log('[InstallReferrer] Stored referrer data:', referrerData);
            }

            // Mark as processed
            await AsyncStorage.setItem(INSTALL_REFERRER_PROCESSED_KEY, 'true');

            this.cachedReferrer = referrerData;
            return referrerData;
        } catch (error) {
            console.error('[InstallReferrer] Error getting install referrer:', error);
            return null;
        }
    }

    /**
     * Parse the Google Play referrer string
     * Format: utm_source=referral&utm_content=DUK123456&utm_campaign=user_referral
     */
    private parseReferrerString(referrer: string): InstallReferrerData {
        const data: InstallReferrerData = {
            referralCode: null,
            utmSource: null,
            utmMedium: null,
            utmCampaign: null,
            utmContent: null,
            installReferrer: referrer,
            referrerClickTimestamp: null,
            installBeginTimestamp: null,
            salesTeamCode: null,
        };

        try {
            // Decode URL-encoded referrer string
            const decodedReferrer = decodeURIComponent(referrer);
            const params = new URLSearchParams(decodedReferrer);

            data.utmSource = params.get('utm_source');
            data.utmMedium = params.get('utm_medium');
            data.utmCampaign = params.get('utm_campaign');
            data.utmContent = params.get('utm_content');

            // Extract referral code from utm_content or dedicated param
            const code = params.get('referral_code') || params.get('utm_content') || params.get('code');

            if (code) {
                // Check if it's a sales team code
                if (code.startsWith('SALES_') || code.startsWith('ST_')) {
                    data.salesTeamCode = code;
                    data.referralCode = code;
                } else {
                    data.referralCode = code;
                }
            }
        } catch (error) {
            console.error('[InstallReferrer] Error parsing referrer string:', error);
        }

        return data;
    }

    /**
     * Parse deep link URL for referral data
     * Handles URLs like: dukaaon://referral?code=DUK123456
     * Or: https://dukaaon.app/r/DUK123456
     */
    private parseDeepLinkUrl(url: string): Partial<InstallReferrerData> {
        const data: Partial<InstallReferrerData> = {};

        try {
            // Handle path-based referral: /r/CODE
            const pathMatch = url.match(/\/r\/([A-Za-z0-9_]+)/);
            if (pathMatch) {
                data.referralCode = pathMatch[1];
                return data;
            }

            // Handle query-based referral
            const urlObj = new URL(url);
            const code = urlObj.searchParams.get('code') ||
                urlObj.searchParams.get('referral_code') ||
                urlObj.searchParams.get('ref');

            if (code) {
                data.referralCode = code;
            }

            data.utmSource = urlObj.searchParams.get('utm_source') || undefined;
            data.utmMedium = urlObj.searchParams.get('utm_medium') || undefined;
            data.utmCampaign = urlObj.searchParams.get('utm_campaign') || undefined;
        } catch (error) {
            console.log('[InstallReferrer] Error parsing deep link URL:', error);
        }

        return data;
    }

    /**
     * Generate Play Store URL with referral tracking
     * This is what users should share!
     */
    generatePlayStoreReferralLink(
        referralCode: string,
        options?: {
            packageName?: string;
            source?: string;
            campaign?: string;
        }
    ): string {
        const packageName = options?.packageName || 'com.dukaaon.app';
        const source = options?.source || 'referral';
        const campaign = options?.campaign || 'user_referral';

        // Build the referrer string
        const referrerParams = new URLSearchParams({
            utm_source: source,
            utm_medium: 'app_share',
            utm_campaign: campaign,
            utm_content: referralCode,
            referral_code: referralCode,
        });

        // Encode the referrer string for the Play Store URL
        const encodedReferrer = encodeURIComponent(referrerParams.toString());

        return `https://play.google.com/store/apps/details?id=${packageName}&referrer=${encodedReferrer}`;
    }

    /**
     * Generate a universal link that works for both installed and not installed cases
     * Uses your website as a fallback that redirects to Play Store with referrer
     */
    generateUniversalReferralLink(
        referralCode: string,
        baseUrl: string = 'https://dukaaon.app'
    ): string {
        // This link goes to your website, which should:
        // 1. If app is installed: open the app directly
        // 2. If app is not installed: redirect to Play Store with referrer params
        return `${baseUrl}/r/${referralCode}`;
    }

    /**
     * Clear stored referrer data (for testing)
     */
    async clearReferrerData(): Promise<void> {
        await AsyncStorage.multiRemove([INSTALL_REFERRER_KEY, INSTALL_REFERRER_PROCESSED_KEY]);
        this.cachedReferrer = null;
    }

    /**
     * Get referral code for signup
     * Returns the referral code if available
     */
    async getReferralCodeForSignup(): Promise<string | null> {
        if (this.cachedReferrer) {
            return this.cachedReferrer.referralCode;
        }

        const data = await this.getInstallReferrer();
        return data?.referralCode || null;
    }

    /**
     * Check if this is a sales team referral
     */
    async isSalesTeamReferral(): Promise<boolean> {
        if (this.cachedReferrer) {
            return !!this.cachedReferrer.salesTeamCode;
        }

        const data = await this.getInstallReferrer();
        return !!data?.salesTeamCode;
    }
}

export const installReferrerService = new InstallReferrerService();
export default installReferrerService;
