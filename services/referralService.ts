/**
 * Referral Service
 * Handles all referral-related functionality including:
 * - Generating and managing referral codes
 * - Tracking referral link clicks
 * - Processing referrals on signup (with/without explicit code)
 * - Managing rewards
 * - Fetching referral program settings from Supabase
 */

import { supabase } from './supabase/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import { installReferrerService } from './installReferrerService';

// Storage keys
const REFERRAL_CLICK_KEY = 'referral_click_data';
const DEVICE_FINGERPRINT_KEY = 'device_fingerprint';

// Types
export interface ReferralSettings {
    referrer_reward: {
        amount: number;
        currency: string;
        type: string;
        description: string;
    };
    referee_reward: {
        amount: number;
        currency: string;
        type: string;
        description: string;
    };
    min_order_for_reward: {
        amount: number;
        currency: string;
    };
    program_status: {
        enabled: boolean;
        message: string;
    };
    max_referrals_per_user: {
        limit: number;
        period: string;
        unlimited: boolean;
    };
    // Dynamic UI Content
    ui_banner_title?: { [lang: string]: string };
    ui_banner_subtitle?: { [lang: string]: string };
    ui_share_button_text?: { [lang: string]: string };
    ui_copy_code_text?: { [lang: string]: string };
    share_message_template?: { [lang: string]: string };
    ui_banner_colors?: {
        gradient_start: string;
        gradient_end: string;
        text_color: string;
        code_bg_color: string;
        code_text_color: string;
    };
    current_offer?: {
        enabled: boolean;
        title: string;
        description: string;
        start_date: string;
        end_date: string;
        bonus_amount: number;
        min_referrals: number;
    };
    app_store_links?: {
        play_store: string;
        app_store: string;
        package_name: string;
    };
    milestone_rewards?: Array<{
        referrals: number;
        bonus: number;
        title: string;
    }>;
    terms_and_conditions?: { [lang: string]: string[] };
}

export interface ReferralStats {
    referral_code: string;
    reward_per_referral: {
        amount: number;
        currency: string;
    };
    total_referrals: number;
    total_earnings: number;
    wallet_balance: number;
    pending_referrals: number;
    successful_referrals: number;
}

export interface ReferralClickData {
    code: string;
    source: string;
    timestamp: number;
    deviceFingerprint: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
}

class ReferralService {
    private cachedSettings: ReferralSettings | null = null;
    private settingsLastFetched: number = 0;
    private readonly SETTINGS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    /**
     * Generate a unique device fingerprint for tracking
     * Uses available device info without requiring additional expo packages
     */
    async getDeviceFingerprint(): Promise<string> {
        try {
            // Try to get cached fingerprint first
            const cached = await AsyncStorage.getItem(DEVICE_FINGERPRINT_KEY);
            if (cached) return cached;

            // Generate new fingerprint based on available device characteristics
            const components: string[] = [
                Platform.OS,
                String(Platform.Version || 'unknown'),
            ];

            // Try to get device info from PlatformConstants on Android
            try {
                if (Platform.OS === 'android' && NativeModules.PlatformConstants) {
                    const constants = NativeModules.PlatformConstants;
                    if (constants.Brand) components.push(String(constants.Brand));
                    if (constants.Model) components.push(String(constants.Model));
                }
            } catch (e) {
                // Ignore - not critical
            }

            // Add random components for uniqueness
            const randomPart = Math.random().toString(36).substring(2, 10);
            components.push(randomPart);

            // Create a hash-like fingerprint
            const fingerprint = components
                .filter(Boolean)
                .join('|')
                .split('')
                .reduce((a, b) => {
                    a = ((a << 5) - a) + b.charCodeAt(0);
                    return a & a;
                }, 0)
                .toString(36);

            const fullFingerprint = `${Platform.OS}_${fingerprint}_${Date.now().toString(36)}`;

            // Cache it
            await AsyncStorage.setItem(DEVICE_FINGERPRINT_KEY, fullFingerprint);

            return fullFingerprint;
        } catch (error) {
            console.error('[ReferralService] Error generating fingerprint:', error);
            return `${Platform.OS}_${Date.now().toString(36)}`;
        }
    }

    /**
     * Record a referral link click (called when user opens app via referral link)
     */
    async recordReferralClick(data: {
        code: string;
        source?: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
    }): Promise<void> {
        try {
            const deviceFingerprint = await this.getDeviceFingerprint();

            // Store locally for later use during signup
            const clickData: ReferralClickData = {
                code: data.code,
                source: data.source || 'direct',
                timestamp: Date.now(),
                deviceFingerprint,
                utmSource: data.utmSource,
                utmMedium: data.utmMedium,
                utmCampaign: data.utmCampaign,
            };

            await AsyncStorage.setItem(REFERRAL_CLICK_KEY, JSON.stringify(clickData));

            // Also record in database for attribution
            const { error } = await supabase.rpc('record_referral_click', {
                p_referral_code: data.code,
                p_device_fingerprint: deviceFingerprint,
                p_platform: Platform.OS,
                p_click_source: data.source || 'direct',
                p_utm_source: data.utmSource,
                p_utm_medium: data.utmMedium,
                p_utm_campaign: data.utmCampaign,
            });

            if (error) {
                console.warn('[ReferralService] Error recording click in DB:', error);
            } else {
                console.log('[ReferralService] Referral click recorded:', data.code);
            }
        } catch (error) {
            console.error('[ReferralService] Error recording referral click:', error);
        }
    }

    /**
     * Get stored referral click data (if any)
     */
    async getStoredReferralClick(): Promise<ReferralClickData | null> {
        try {
            const stored = await AsyncStorage.getItem(REFERRAL_CLICK_KEY);
            if (!stored) return null;

            const data: ReferralClickData = JSON.parse(stored);

            // Check if click is still valid (within 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            if (data.timestamp < sevenDaysAgo) {
                await AsyncStorage.removeItem(REFERRAL_CLICK_KEY);
                return null;
            }

            return data;
        } catch (error) {
            console.error('[ReferralService] Error getting stored click:', error);
            return null;
        }
    }

    /**
     * Process referral on signup (called after user successfully signs up)
     * Works with or without explicit referral code
     * Checks multiple sources for attribution:
     * 1. Explicit code (if user entered one)
     * 2. Stored click data (from deep link)
     * 3. Install referrer (from Play Store install)
     */
    async processReferralOnSignup(
        userId: string,
        explicitCode?: string
    ): Promise<{ success: boolean; message: string; reward?: any }> {
        try {
            // Get stored click data and device fingerprint
            const clickData = await this.getStoredReferralClick();
            const deviceFingerprint = await this.getDeviceFingerprint();

            // Check install referrer (from Play Store)
            let installReferralCode: string | null = null;
            try {
                const installReferrer = await installReferrerService.getInstallReferrer();
                if (installReferrer?.referralCode) {
                    installReferralCode = installReferrer.referralCode;
                    console.log('[ReferralService] Found install referrer code:', installReferralCode);
                }
            } catch (installError) {
                console.log('[ReferralService] Install referrer not available:', installError);
            }

            // Priority: explicit code > click data > install referrer
            const referralCode = explicitCode || clickData?.code || installReferralCode;

            console.log('[ReferralService] Processing referral:', {
                userId,
                referralCode,
                source: explicitCode ? 'explicit' : (clickData?.code ? 'click_data' : (installReferralCode ? 'install_referrer' : 'none')),
                hasClickData: !!clickData,
                hasInstallReferrer: !!installReferralCode,
                deviceFingerprint,
            });

            const { data, error } = await supabase.rpc('process_referral_on_signup', {
                p_new_user_id: userId,
                p_referral_code: referralCode || null,
                p_device_fingerprint: deviceFingerprint,
            });

            if (error) {
                console.error('[ReferralService] Error processing referral:', error);
                return { success: false, message: error.message };
            }

            // Clear stored click data after processing
            await AsyncStorage.removeItem(REFERRAL_CLICK_KEY);

            console.log('[ReferralService] Referral processed:', data);

            return {
                success: data?.success || false,
                message: data?.message || 'Referral processed',
                reward: data?.referee_reward,
            };
        } catch (error) {
            console.error('[ReferralService] Error in processReferralOnSignup:', error);
            return { success: false, message: 'Error processing referral' };
        }
    }

    /**
     * Fetch referral program settings from Supabase
     */
    async getReferralSettings(): Promise<ReferralSettings | null> {
        try {
            // Check cache
            const now = Date.now();
            if (this.cachedSettings && (now - this.settingsLastFetched) < this.SETTINGS_CACHE_DURATION) {
                return this.cachedSettings;
            }

            const { data, error } = await supabase.rpc('get_referral_program_info');

            if (error) {
                console.error('[ReferralService] Error fetching settings:', error);
                return this.cachedSettings;
            }

            this.cachedSettings = data as ReferralSettings;
            this.settingsLastFetched = now;

            return this.cachedSettings;
        } catch (error) {
            console.error('[ReferralService] Error in getReferralSettings:', error);
            return null;
        }
    }

    /**
     * Get user's referral stats
     */
    async getUserReferralStats(userId: string): Promise<ReferralStats | null> {
        try {
            const { data, error } = await supabase.rpc('get_referral_stats', {
                p_user_id: userId,
            });

            if (error) {
                console.error('[ReferralService] Error fetching stats:', error);
                return null;
            }

            return data as ReferralStats;
        } catch (error) {
            console.error('[ReferralService] Error in getUserReferralStats:', error);
            return null;
        }
    }

    /**
     * Generate share message with referral link
     * Uses dynamic template from Supabase settings
     * Includes Play Store link with referrer tracking for attribution through install
     */
    async generateShareMessage(
        referralCode: string,
        language: string = 'en'
    ): Promise<{
        message: string;
        link: string;
        playStoreLink: string;
    }> {
        const settings = await this.getReferralSettings();

        // Get package name and Play Store link from settings
        const packageName = settings?.app_store_links?.package_name || 'com.sixn8.dukaaon';
        const basePlayStoreLink = settings?.app_store_links?.play_store ||
            `https://play.google.com/store/apps/details?id=${packageName}`;

        // Universal deep link (works if app is installed)
        const universalLink = `https://dukaaon.app/r/${referralCode}`;

        // Play Store link with referrer tracking (for new installs)
        const referrerParams = new URLSearchParams({
            utm_source: 'referral',
            utm_medium: 'app_share',
            utm_campaign: 'user_referral',
            utm_content: referralCode,
            referral_code: referralCode,
        });
        const playStoreLink = `${basePlayStoreLink}&referrer=${encodeURIComponent(referrerParams.toString())}`;

        // Get referee reward amount
        const refereeReward = settings?.referee_reward?.amount || 50;

        // Try to use dynamic template from settings
        let message: string;
        const template = settings?.share_message_template?.[language] ||
            settings?.share_message_template?.['en'];

        if (template) {
            // Replace placeholders in template
            message = template
                .replace(/\{\{CODE\}\}/g, referralCode)
                .replace(/\{\{REFEREE_REWARD\}\}/g, String(refereeReward))
                .replace(/\{\{REFERRER_REWARD\}\}/g, String(settings?.referrer_reward?.amount || 100))
                .replace(/\{\{LINK\}\}/g, playStoreLink);
        } else {
            // Fallback to default message
            message = `Join dukaaOn with my referral code: ${referralCode}

🎁 You'll get ₹${refereeReward} off on your first order!
🛒 Shop from nearby wholesalers at best prices

Download now: ${playStoreLink}`;
        }

        return { message, link: universalLink, playStoreLink };
    }

    /**
     * Complete referral after first order
     */
    async completeReferralOnOrder(
        userId: string,
        orderId: string,
        orderAmount: number
    ): Promise<{ success: boolean; message: string }> {
        try {
            const { data, error } = await supabase.rpc('complete_referral_on_first_order', {
                p_user_id: userId,
                p_order_id: orderId,
                p_order_amount: orderAmount,
            });

            if (error) {
                console.error('[ReferralService] Error completing referral:', error);
                return { success: false, message: error.message };
            }

            return {
                success: data?.success || false,
                message: data?.message || 'Order processed',
            };
        } catch (error) {
            console.error('[ReferralService] Error in completeReferralOnOrder:', error);
            return { success: false, message: 'Error completing referral' };
        }
    }

    /**
     * Check if referral program is enabled
     */
    async isProgramEnabled(): Promise<boolean> {
        const settings = await this.getReferralSettings();
        return settings?.program_status?.enabled ?? false;
    }
}

export const referralService = new ReferralService();
export default referralService;
