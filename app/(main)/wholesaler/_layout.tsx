import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { SellerBottomNav } from '../../../components/navigation/SellerBottomNav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WholesalerLayout() {
  console.log('WholesalerLayout rendering');
  const insets = useSafeAreaInsets();

  // Bottom nav height: nav content (85) + safe area inset
  const BOTTOM_NAV_HEIGHT = 85;
  const totalBottomHeight = BOTTOM_NAV_HEIGHT + insets.bottom;

  return (
    <View style={styles.container}>
      {/* Main content area with padding to prevent overlap with bottom nav */}
      <View style={[styles.content, { paddingBottom: totalBottomHeight }]}>
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            animation: 'none',
            header: () => null,
          }}
        />
      </View>

      {/* Bottom Navigation - positioned at the very bottom */}
      <View style={[
        styles.bottomNavContainer,
        { height: totalBottomHeight, paddingBottom: insets.bottom }
      ]}>
        <SellerBottomNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    // Elevation for Android
    elevation: 16,
  },
});