import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { SellerBottomNav } from '../../../components/navigation/SellerBottomNav';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';

export default function WholesalerLayout() {
  console.log('WholesalerLayout rendering');
  
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  
  // Calculate dynamic bottom navigation height based on device insets
  const bottomNavHeight = 20 + insets.bottom;
  const contentMargin = 20; // Fixed margin without extra inset padding
  
  return (
    <View style={[styles.container, getSafeAreaStyles(insets)]}>
      <View style={[styles.content, { marginBottom: contentMargin }]}>
        <Stack
          screenOptions={({ route }) => ({
            headerShown: false,
            gestureEnabled: true
          })}
        >
        </Stack>
      </View>
      <View style={[styles.bottomNavContainer, { 
        height: bottomNavHeight,
        paddingBottom: insets.bottom
      }]}>
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
    elevation: 24,
    zIndex: 1100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});