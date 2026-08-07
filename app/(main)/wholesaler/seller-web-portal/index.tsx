/**
 * Seller Web Portal - WebView screen for accessing seller.dukaaon.in
 * 
 * This screen opens the seller web portal within the app using WebView.
 * It implements SSO (Single Sign-On) by passing Supabase tokens via URL hash.
 * The web app reads these tokens and authenticates using setSession().
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Platform,
    BackHandler,
} from 'react-native';
import { Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../../../store/auth';
import { SystemStatusBar } from '../../../../components/SystemStatusBar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme colors
const THEME = {
    primary: '#001F3F',
    secondary: '#39CCCC',
    background: '#F8F9FC',
    textLight: '#FFFFFF',
};

// Seller web portal URL
const SELLER_PORTAL_URL = 'https://seller.dukaaon.in';

// Supabase auth storage key - must match the one used in supabase.ts
const SUPABASE_AUTH_KEY = 'sb-xcpznnkpjgyrpbvpnvit-auth-token';

export default function SellerWebPortal() {
    const router = useRouter();
    const { user } = useAuthStore();
    const webViewRef = useRef<WebView>(null);

    const [loading, setLoading] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const [pageTitle, setPageTitle] = useState('Seller Web Portal');
    const [portalUrl, setPortalUrl] = useState<string | null>(null);

    // Get session tokens and build SSO URL
    useEffect(() => {
        const buildSSOUrl = async () => {
            try {
                const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);

                if (sessionStr) {
                    const sessionData = JSON.parse(sessionStr);
                    const accessToken = sessionData?.access_token;
                    const refreshToken = sessionData?.refresh_token;

                    if (accessToken && refreshToken) {
                        // Build URL with tokens in hash fragment (more secure than query params)
                        // Hash fragments are not sent to the server, only processed by client-side JS
                        const ssoUrl = `${SELLER_PORTAL_URL}#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=sso`;
                        console.log('SSO URL built successfully');
                        setPortalUrl(ssoUrl);
                        return;
                    }
                }

                // Fallback to regular URL if no session
                console.log('No session found, using regular URL');
                setPortalUrl(SELLER_PORTAL_URL);
            } catch (error) {
                console.error('Error building SSO URL:', error);
                setPortalUrl(SELLER_PORTAL_URL);
            }
        };

        buildSSOUrl();
    }, []);

    // Handle hardware back button
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (canGoBack && webViewRef.current) {
                    webViewRef.current.goBack();
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [canGoBack])
    );

    // JavaScript to inject for SSO handling
    // This script helps the web app process the tokens from the URL hash
    const ssoHelperScript = `
    (function() {
      try {
        // Check if we have SSO tokens in the URL hash
        const hash = window.location.hash;
        if (hash && hash.includes('access_token') && hash.includes('type=sso')) {
          console.log('SSO: Found tokens in URL hash');
          
          // Parse hash parameters
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('SSO: Tokens extracted, attempting auto-login...');
            
            // Store in localStorage for Supabase to pick up
            // Supabase client looks for session in localStorage with specific key format
            const supabaseKey = 'sb-xcpznnkpjgyrpbvpnvit-auth-token';
            const sessionData = {
              access_token: accessToken,
              refresh_token: refreshToken,
              token_type: 'bearer',
              expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
            };
            
            localStorage.setItem(supabaseKey, JSON.stringify(sessionData));
            console.log('SSO: Session stored in localStorage');
            
            // Clear the hash to clean up the URL
            history.replaceState(null, '', window.location.pathname + window.location.search);
            
            // Trigger a page reload to let Supabase pick up the session
            // Small delay to ensure localStorage is written
            setTimeout(function() {
              console.log('SSO: Reloading page to activate session...');
              window.location.reload();
            }, 100);
          }
        }
      } catch (e) {
        console.error('SSO Error:', e);
      }
    })();
    true;
  `;

    const handleNavigationStateChange = (navState: any) => {
        setCanGoBack(navState.canGoBack);
        if (navState.title) {
            setPageTitle(navState.title);
        }
    };

    const handleGoBack = () => {
        if (canGoBack && webViewRef.current) {
            webViewRef.current.goBack();
        } else {
            router.back();
        }
    };

    const handleRefresh = () => {
        if (webViewRef.current) {
            webViewRef.current.reload();
        }
    };

    // Don't render WebView until we have the URL ready
    if (!portalUrl) {
        return (
            <View style={styles.container}>
                <SystemStatusBar style="light" />
                <LinearGradient
                    colors={[THEME.primary, '#003366']}
                    style={styles.header}
                >
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => router.back()}
                    >
                        <MaterialCommunityIcons name="close" size={24} color={THEME.textLight} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Seller Console</Text>
                    </View>
                    <View style={styles.headerButton} />
                </LinearGradient>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={THEME.secondary} />
                    <Text style={styles.loadingText}>Preparing SSO login...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SystemStatusBar style="light" />

            {/* Header */}
            <LinearGradient
                colors={[THEME.primary, '#003366']}
                style={styles.header}
            >
                <TouchableOpacity
                    style={styles.headerButton}
                    onPress={handleGoBack}
                >
                    <MaterialCommunityIcons
                        name={canGoBack ? "arrow-left" : "close"}
                        size={24}
                        color={THEME.textLight}
                    />
                </TouchableOpacity>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        Seller Console
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.headerButton}
                    onPress={handleRefresh}
                >
                    <MaterialCommunityIcons name="refresh" size={24} color={THEME.textLight} />
                </TouchableOpacity>
            </LinearGradient>

            {/* WebView */}
            <WebView
                ref={webViewRef}
                source={{ uri: portalUrl }}
                style={styles.webView}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onNavigationStateChange={handleNavigationStateChange}
                injectedJavaScript={ssoHelperScript}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scalesPageToFit={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                mixedContentMode="compatibility"
                userAgent={Platform.OS === 'android'
                    ? 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
                    : undefined
                }
                renderLoading={() => (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={THEME.secondary} />
                        <Text style={styles.loadingText}>Loading Seller Portal...</Text>
                    </View>
                )}
                onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.error('WebView error:', nativeEvent);
                }}
            />

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 44 : 20, // Reduced from 50/35
        paddingBottom: 8, // Reduced from 12
        paddingHorizontal: 8,
    },
    headerButton: {
        width: 36, // Reduced from 44
        height: 36, // Reduced from 44
        borderRadius: 18, // Adjusted
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    headerTitle: {
        fontSize: 17, // Slightly reduced from 18
        fontWeight: '700',
        color: THEME.textLight,
    },
    webView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: THEME.background,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#666',
    },
});
