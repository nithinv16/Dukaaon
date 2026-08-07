import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Text, TextInput, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Theme colors for retailer
const THEME = {
    primary: '#FF7D00',
    secondary: '#FF9F40',
    background: '#F8F9FC',
    card: '#FFFFFF',
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    success: '#10B981',
};

interface ProfileForm {
    phone_number: string;
    email: string;
    shopName: string;
    ownerName: string;
    address: string;
    gstNumber: string;
}

export default function EditProfile() {
    const router = useRouter();
    const user = useAuthStore(state => state.user);
    const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
    const { currentLanguage } = useLanguage();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [updatingLocation, setUpdatingLocation] = useState(false);

    // Current profile values (from database)
    const [currentProfile, setCurrentProfile] = useState<ProfileForm>({
        phone_number: '',
        email: '',
        shopName: '',
        ownerName: '',
        address: '',
        gstNumber: '',
    });

    // Form values (editable)
    const [form, setForm] = useState<ProfileForm>({
        phone_number: '',
        email: '',
        shopName: '',
        ownerName: '',
        address: '',
        gstNumber: '',
    });

    // Current location
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number | null; longitude: number | null }>({
        latitude: null,
        longitude: null,
    });

    const [translations, setTranslations] = useState({
        editProfile: 'Edit Profile',
        personalInfo: 'Personal Information',
        businessInfo: 'Business Information',
        phoneNumber: 'Phone Number',
        email: 'Email',
        shopName: 'Shop Name',
        ownerName: 'Owner Name',
        address: 'Address',
        gstNumber: 'GST Number',
        location: 'Location',
        updateLocation: 'Update Location',
        currentLocation: 'Current Location',
        submitChanges: 'Submit Changes for Approval',
        noChanges: 'No Changes',
        noChangesMessage: 'No changes were made to your profile.',
        changesSubmitted: 'Changes Submitted',
        changesSubmittedMessage: 'Your profile changes have been submitted for approval. You will be notified once they are reviewed.',
        locationSubmitted: 'Location Update Submitted',
        locationSubmittedMessage: 'Your location update has been submitted for approval.',
        error: 'Error',
        failedToLoad: 'Failed to load profile',
        failedToSubmit: 'Failed to submit changes',
        locationPermissionRequired: 'Location permission is required',
        cancel: 'Cancel',
    });

    // Load translations
    useEffect(() => {
        const loadTranslations = async () => {
            if (!currentLanguage || currentLanguage === 'en') return;

            try {
                const keys = Object.keys(translations);
                const promises = keys.map(key =>
                    translationService.translateText((translations as any)[key], currentLanguage)
                );
                const results = await Promise.all(promises);
                const newTranslations: any = {};
                keys.forEach((key, index) => {
                    newTranslations[key] = results[index].translatedText;
                });
                setTranslations(newTranslations);
            } catch (error) {
                console.error('Error loading translations:', error);
            }
        };

        loadTranslations();
    }, [currentLanguage]);

    // Fetch current profile
    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.id) return;

            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('profiles')
                    .select('phone_number, email, business_details, latitude, longitude')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                const businessDetails = data?.business_details || {};
                const profile: ProfileForm = {
                    phone_number: data?.phone_number || '',
                    email: data?.email || '',
                    shopName: businessDetails.shopName || '',
                    ownerName: businessDetails.ownerName || '',
                    address: businessDetails.address || '',
                    gstNumber: businessDetails.gstNumber || businessDetails.gstin || '',
                };

                setCurrentProfile(profile);
                setForm(profile);
                setCurrentLocation({
                    latitude: data?.latitude || null,
                    longitude: data?.longitude || null,
                });
            } catch (error) {
                console.error('Error fetching profile:', error);
                Alert.alert(translations.error, translations.failedToLoad);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user?.id]);

    // Handle form submission
    const handleSubmit = async () => {
        try {
            setSaving(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Build current values and requested changes
            const currentValues: Record<string, any> = {};
            const requestedChanges: Record<string, any> = {};

            // Check which fields have changed
            if (form.phone_number !== currentProfile.phone_number) {
                currentValues.phone_number = currentProfile.phone_number;
                requestedChanges.phone_number = form.phone_number;
            }
            if (form.email !== currentProfile.email) {
                currentValues.email = currentProfile.email;
                requestedChanges.email = form.email;
            }
            if (form.shopName !== currentProfile.shopName) {
                currentValues.shopName = currentProfile.shopName;
                requestedChanges.shopName = form.shopName;
            }
            if (form.ownerName !== currentProfile.ownerName) {
                currentValues.ownerName = currentProfile.ownerName;
                requestedChanges.ownerName = form.ownerName;
            }
            if (form.address !== currentProfile.address) {
                currentValues.address = currentProfile.address;
                requestedChanges.address = form.address;
            }
            if (form.gstNumber !== currentProfile.gstNumber) {
                currentValues.gstNumber = currentProfile.gstNumber;
                requestedChanges.gstNumber = form.gstNumber;
            }

            // If no changes, show message
            if (Object.keys(requestedChanges).length === 0) {
                Alert.alert(translations.noChanges, translations.noChangesMessage);
                return;
            }

            // Submit change request for approval
            const { error } = await supabase
                .from('profile_change_requests')
                .insert({
                    user_id: user?.id,
                    user_role: 'retailer',
                    current_values: currentValues,
                    requested_changes: requestedChanges,
                    status: 'pending'
                });

            if (error) throw error;

            // Reset form to current values
            setForm(currentProfile);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                translations.changesSubmitted,
                translations.changesSubmittedMessage,
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (error) {
            console.error('Error submitting changes:', error);
            Alert.alert(translations.error, translations.failedToSubmit);
        } finally {
            setSaving(false);
        }
    };

    // Handle location update
    const handleUpdateLocation = async () => {
        try {
            setUpdatingLocation(true);

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(translations.error, translations.locationPermissionRequired);
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            // Submit location change for approval
            const { error } = await supabase
                .from('profile_change_requests')
                .insert({
                    user_id: user?.id,
                    user_role: 'retailer',
                    current_values: {
                        latitude: currentLocation.latitude,
                        longitude: currentLocation.longitude
                    },
                    requested_changes: {
                        latitude,
                        longitude
                    },
                    status: 'pending'
                });

            if (error) throw error;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                translations.locationSubmitted,
                translations.locationSubmittedMessage,
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error updating location:', error);
            Alert.alert(translations.error, translations.failedToSubmit);
        } finally {
            setUpdatingLocation(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer, getSafeAreaStyles(insets)]}>
                <ActivityIndicator size="large" color={THEME.primary} />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, getSafeAreaStyles(insets)]}>
            {/* Header */}
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    size={24}
                    onPress={() => router.back()}
                />
                <Text style={styles.headerTitle}>{translations.editProfile}</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <MaterialCommunityIcons name="information-outline" size={20} color={THEME.primary} />
                    <Text style={styles.infoBannerText}>
                        Changes to your profile information require admin approval for security reasons.
                    </Text>
                </View>

                {/* Personal Information Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{translations.personalInfo}</Text>

                    <TextInput
                        label={translations.phoneNumber}
                        value={form.phone_number}
                        onChangeText={(text) => setForm({ ...form, phone_number: text })}
                        style={styles.input}
                        mode="outlined"
                        keyboardType="phone-pad"
                        outlineColor={THEME.border}
                        activeOutlineColor={THEME.primary}
                        left={<TextInput.Icon icon="phone" />}
                    />

                    <TextInput
                        label={translations.email}
                        value={form.email}
                        onChangeText={(text) => setForm({ ...form, email: text })}
                        style={styles.input}
                        mode="outlined"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        outlineColor={THEME.border}
                        activeOutlineColor={THEME.primary}
                        left={<TextInput.Icon icon="email" />}
                    />
                </View>

                {/* Business Information Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{translations.businessInfo}</Text>

                    <TextInput
                        label={translations.shopName}
                        value={form.shopName}
                        onChangeText={(text) => setForm({ ...form, shopName: text })}
                        style={styles.input}
                        mode="outlined"
                        outlineColor={THEME.border}
                        activeOutlineColor={THEME.primary}
                        left={<TextInput.Icon icon="store" />}
                    />

                    <TextInput
                        label={translations.ownerName}
                        value={form.ownerName}
                        onChangeText={(text) => setForm({ ...form, ownerName: text })}
                        style={styles.input}
                        mode="outlined"
                        outlineColor={THEME.border}
                        activeOutlineColor={THEME.primary}
                        left={<TextInput.Icon icon="account" />}
                    />

                    <TextInput
                        label={translations.address}
                        value={form.address}
                        onChangeText={(text) => setForm({ ...form, address: text })}
                        style={styles.input}
                        mode="outlined"
                        multiline
                        numberOfLines={3}
                        outlineColor={THEME.border}
                        activeOutlineColor={THEME.primary}
                        left={<TextInput.Icon icon="map-marker" />}
                    />

                    <TextInput
                        label={translations.gstNumber}
                        value={form.gstNumber}
                        onChangeText={(text) => setForm({ ...form, gstNumber: text })}
                        style={styles.input}
                        mode="outlined"
                        autoCapitalize="characters"
                        outlineColor={THEME.border}
                        activeOutlineColor={THEME.primary}
                        left={<TextInput.Icon icon="file-document" />}
                    />
                </View>

                {/* Location Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{translations.location}</Text>

                    <View style={styles.locationCard}>
                        <View style={styles.locationInfo}>
                            <MaterialCommunityIcons name="map-marker" size={24} color={THEME.primary} />
                            <View style={styles.locationText}>
                                <Text style={styles.locationLabel}>{translations.currentLocation}</Text>
                                <Text style={styles.locationValue}>
                                    {currentLocation.latitude && currentLocation.longitude
                                        ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
                                        : 'Not set'}
                                </Text>
                            </View>
                        </View>

                        <Button
                            mode="outlined"
                            onPress={handleUpdateLocation}
                            loading={updatingLocation}
                            disabled={updatingLocation}
                            icon="crosshairs-gps"
                            style={styles.locationButton}
                            textColor={THEME.primary}
                        >
                            {translations.updateLocation}
                        </Button>
                    </View>
                </View>

                {/* Submit Button */}
                <Button
                    mode="contained"
                    onPress={handleSubmit}
                    loading={saving}
                    disabled={saving}
                    style={styles.submitButton}
                    contentStyle={styles.submitButtonContent}
                    buttonColor={THEME.primary}
                >
                    {translations.submitChanges}
                </Button>

                <View style={styles.bottomPadding} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: THEME.textSecondary,
    },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: THEME.card,
        borderBottomWidth: 1,
        borderBottomColor: THEME.border,
        paddingHorizontal: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: THEME.text,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFF7ED',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    infoBannerText: {
        flex: 1,
        marginLeft: 10,
        fontSize: 13,
        color: THEME.text,
        lineHeight: 18,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.text,
        marginBottom: 12,
    },
    input: {
        marginBottom: 12,
        backgroundColor: THEME.card,
    },
    locationCard: {
        backgroundColor: THEME.card,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    locationText: {
        marginLeft: 12,
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        color: THEME.textSecondary,
    },
    locationValue: {
        fontSize: 14,
        color: THEME.text,
        fontWeight: '500',
        marginTop: 2,
    },
    locationButton: {
        borderColor: THEME.primary,
    },
    submitButton: {
        marginTop: 8,
        borderRadius: 12,
    },
    submitButtonContent: {
        paddingVertical: 8,
    },
    bottomPadding: {
        height: 100,
    },
});
