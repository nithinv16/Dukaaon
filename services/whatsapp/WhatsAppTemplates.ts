/**
 * WhatsApp Templates Service
 * 
 * Fetches template configurations from database - NO HARDCODING!
 * Template IDs can be updated in Supabase without app changes.
 */

import { supabase } from '../supabase/supabase';

// Template categories
export type TemplateCategory = 'order' | 'payment' | 'delivery' | 'marketing' | 'support';

// Template configuration from database
export interface TemplateConfig {
    id: string;
    template_key: string;
    template_name: string;
    authkey_template_id: string | null;
    category: TemplateCategory;
    description: string;
    variable_count: number;
    variable_mapping: Record<string, string>;
    is_automatic: boolean;
    is_enabled: boolean;
    trigger_event: string | null;
    trigger_conditions: Record<string, any> | null;
    send_time_preference: string;
    cooldown_minutes: number;
    max_sends_per_day: number | null;
    priority: number;
}

// Cache for template configs
let templateCache: Map<string, TemplateConfig> = new Map();
let cacheExpiry: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load all template configurations from database
 */
export async function loadTemplateConfigs(): Promise<Map<string, TemplateConfig>> {
    // Check cache
    if (templateCache.size > 0 && Date.now() < cacheExpiry) {
        return templateCache;
    }

    try {
        const { data, error } = await supabase
            .from('whatsapp_template_config')
            .select('*')
            .eq('is_enabled', true);

        if (error) {
            console.error('[WhatsAppTemplates] Error loading configs:', error);
            return templateCache; // Return cached data on error
        }

        // Update cache
        templateCache = new Map();
        for (const config of data || []) {
            templateCache.set(config.template_key, config);
        }
        cacheExpiry = Date.now() + CACHE_DURATION_MS;

        console.log(`[WhatsAppTemplates] Loaded ${templateCache.size} template configs`);
        return templateCache;
    } catch (error) {
        console.error('[WhatsAppTemplates] Failed to load configs:', error);
        return templateCache;
    }
}

/**
 * Get a specific template config by key
 */
export async function getTemplateConfig(templateKey: string): Promise<TemplateConfig | null> {
    const configs = await loadTemplateConfigs();
    return configs.get(templateKey) || null;
}

/**
 * Get the Authkey template ID for a template key
 * Returns null if template doesn't exist or isn't configured
 */
export async function getTemplateId(templateKey: string): Promise<string | null> {
    const config = await getTemplateConfig(templateKey);
    return config?.authkey_template_id || null;
}

/**
 * Check if a template is available (has an Authkey ID configured)
 */
export async function isTemplateAvailable(templateKey: string): Promise<boolean> {
    const config = await getTemplateConfig(templateKey);
    return !!(config?.authkey_template_id && config.is_enabled);
}

/**
 * Get all templates for a specific trigger event
 */
export async function getTemplatesForEvent(event: string): Promise<TemplateConfig[]> {
    const configs = await loadTemplateConfigs();
    return Array.from(configs.values()).filter(
        config => config.trigger_event === event && config.is_automatic
    );
}

/**
 * Get all templates by category
 */
export async function getTemplatesByCategory(category: TemplateCategory): Promise<TemplateConfig[]> {
    const configs = await loadTemplateConfigs();
    return Array.from(configs.values()).filter(config => config.category === category);
}

/**
 * Check if we can send a template (rate limiting)
 */
export async function canSendTemplate(phoneNumber: string, templateKey: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .rpc('check_whatsapp_rate_limit', {
                p_phone_number: phoneNumber,
                p_template_key: templateKey
            });

        if (error) {
            console.warn('[WhatsAppTemplates] Rate limit check failed:', error);
            return true; // Allow on error
        }

        return data === true;
    } catch (error) {
        console.error('[WhatsAppTemplates] Rate limit check error:', error);
        return true;
    }
}

/**
 * Record a template send (for rate limiting and analytics)
 */
export async function recordTemplateSend(
    templateKey: string,
    phoneNumber: string,
    userId?: string,
    orderId?: string,
    variables?: Record<string, string>,
    language: string = 'en',
    authkeyResponse?: any
): Promise<void> {
    try {
        await supabase
            .from('whatsapp_template_sends')
            .insert({
                template_key: templateKey,
                phone_number: phoneNumber,
                user_id: userId,
                related_order_id: orderId,
                variables_used: variables,
                language_used: language,
                status: authkeyResponse?.success ? 'sent' : 'failed',
                authkey_response: authkeyResponse,
                error_message: authkeyResponse?.error
            });
    } catch (error) {
        console.error('[WhatsAppTemplates] Failed to record send:', error);
    }
}

/**
 * Update a template ID (admin function)
 */
export async function updateTemplateId(
    templateKey: string,
    newAuthkeyTemplateId: string
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('whatsapp_template_config')
            .update({
                authkey_template_id: newAuthkeyTemplateId,
                updated_at: new Date().toISOString()
            })
            .eq('template_key', templateKey);

        if (error) {
            console.error('[WhatsAppTemplates] Failed to update template:', error);
            return false;
        }

        // Clear cache to reload
        templateCache.clear();
        cacheExpiry = 0;

        return true;
    } catch (error) {
        console.error('[WhatsAppTemplates] Update error:', error);
        return false;
    }
}

/**
 * Format variables for a template based on its mapping
 */
export async function formatTemplateVariables(
    templateKey: string,
    data: Record<string, any>
): Promise<Record<string, string> | null> {
    const config = await getTemplateConfig(templateKey);
    if (!config || !config.variable_mapping) {
        return null;
    }

    const variables: Record<string, string> = {};
    const mapping = config.variable_mapping;

    for (const [position, fieldName] of Object.entries(mapping)) {
        const value = data[fieldName];
        if (value !== undefined && value !== null) {
            // Format based on field type
            if (typeof value === 'number') {
                // Check if it's a currency field
                if (fieldName.toLowerCase().includes('amount') ||
                    fieldName.toLowerCase().includes('price') ||
                    fieldName.toLowerCase().includes('total')) {
                    variables[position] = `₹${value.toLocaleString('en-IN')}`;
                } else {
                    variables[position] = value.toString();
                }
            } else if (Array.isArray(value)) {
                variables[position] = value.join(', ');
            } else {
                variables[position] = String(value);
            }
        } else {
            variables[position] = '';
        }
    }

    return variables;
}

// ============================================================================
// Template Key Constants (for type safety - keys match database)
// ============================================================================

export const TEMPLATE_KEYS = {
    // Order Management
    NEW_ORDER_RECEIVED: 'NEW_ORDER_RECEIVED',
    ORDER_CONFIRMED: 'ORDER_CONFIRMED',
    ORDER_REJECTED: 'ORDER_REJECTED',
    ORDER_PARTIALLY_AVAILABLE: 'ORDER_PARTIALLY_AVAILABLE',
    ORDER_READY_FOR_PICKUP: 'ORDER_READY_FOR_PICKUP',
    ORDER_CANCELLED_BY_SELLER: 'ORDER_CANCELLED_BY_SELLER',
    ORDER_CANCELLED_BY_RETAILER: 'ORDER_CANCELLED_BY_RETAILER',
    ORDER_CANCELLED_BY_RETAILER_TO_SELLER: 'ORDER_CANCELLED_BY_RETAILER_to_seller',
    ORDER_SUMMARY_DAILY: 'ORDER_SUMMARY_DAILY',

    // Payment & Credit
    PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
    PAYMENT_REMINDER: 'PAYMENT_REMINDER',
    PAYMENT_OVERDUE: 'PAYMENT_OVERDUE',
    PAYMENT_PARTIAL: 'PAYMENT_PARTIAL',
    CREDIT_LIMIT_REACHED: 'CREDIT_LIMIT_REACHED',

    // Delivery & Logistics
    DELIVERY_ASSIGNED: 'DELIVERY_ASSIGNED',
    DELIVERY_STARTED: 'DELIVERY_STARTED',
    DELIVERY_ARRIVING: 'DELIVERY_ARRIVING',
    DELIVERY_COMPLETED: 'DELIVERY_COMPLETED',
    DELIVERY_DELAYED: 'DELIVERY_DELAYED',

    // Marketing & Engagement
    REORDER_REMINDER: 'REORDER_REMINDER',
    LOW_STOCK_ALERT: 'LOW_STOCK_ALERT',
    WELCOME_MESSAGE: 'WELCOME_MESSAGE',
    INACTIVE_USER: 'INACTIVE_USER',

    // Customer Support
    SUPPORT_TICKET_CREATED: 'SUPPORT_TICKET_CREATED',
    SUPPORT_TICKET_RESOLVED: 'SUPPORT_TICKET_RESOLVED',
    GENERAL_RESPONSE: 'GENERAL_RESPONSE',
} as const;

export type TemplateKey = typeof TEMPLATE_KEYS[keyof typeof TEMPLATE_KEYS];

// ============================================================================
// Backward Compatibility Exports (DEPRECATED)
// ============================================================================

/**
 * @deprecated Use getTemplateId() instead - it fetches from database
 * These hardcoded IDs are kept only for backward compatibility
 * All new code should use:
 *   const templateId = await getTemplateId('NEW_ORDER_RECEIVED');
 */
export const TEMPLATE_IDS = {
    // DEPRECATED - All template IDs should come from database
    // Update IDs in Supabase: whatsapp_template_config table
    NEW_ORDER_RECEIVED: '', // Fetch from DB with getTemplateId()
    ORDER_CONFIRMED: '',
    ORDER_REJECTED: '',
    ORDER_PARTIALLY_AVAILABLE: '',
    ORDER_READY_FOR_PICKUP: '',
    ORDER_CANCELLED_BY_SELLER: '',
    ORDER_CANCELLED_BY_RETAILER: '',
    ORDER_SUMMARY_DAILY: '',
    PAYMENT_RECEIVED: '',
    PAYMENT_REMINDER: '',
    PAYMENT_OVERDUE: '',
    PAYMENT_PARTIAL: '',
    CREDIT_LIMIT_REACHED: '',
    DELIVERY_ASSIGNED: '',
    DELIVERY_STARTED: '',
    DELIVERY_ARRIVING: '',
    DELIVERY_COMPLETED: '',
    DELIVERY_DELAYED: '',
    REORDER_REMINDER: '',
    LOW_STOCK_ALERT: '',
    WELCOME_MESSAGE: '',
    INACTIVE_USER: '',
    SUPPORT_TICKET_CREATED: '',
    SUPPORT_TICKET_RESOLVED: '',
    GENERAL_RESPONSE: '',
};
