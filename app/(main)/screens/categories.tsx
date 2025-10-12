import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { IconButton, Card, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../../hooks/useTranslation';
import { COLORS } from '../../../constants/theme';
import { SystemStatusBar } from '../../../components/common/SystemStatusBar';
import { useEdgeToEdge } from '../../../hooks/useEdgeToEdge';
import { CategoryGrid } from '../../../components/home/CategoryGrid';

// Safe router hook with validation
const useSafeRouter = () => {
  let router;
  
  try {
    router = useRouter();
  } catch (error) {
    console.error('[Categories] Error initializing router:', error);
    router = null;
  }
  
  // Create safe router wrapper
  const safeRouter = {
    push: (path: string) => {
      if (router && typeof router.push === 'function') {
        router.push(path);
      } else {
        console.warn('[Categories] router.push not available for path:', path);
      }
    },
    replace: (path: string) => {
      if (router && typeof router.replace === 'function') {
        router.replace(path);
      } else {
        console.warn('[Categories] router.replace not available for path:', path);
      }
    },
    back: () => {
      if (router && typeof router.back === 'function') {
        router.back();
      } else {
        console.warn('[Categories] router.back not available');
      }
    },
    canGoBack: () => {
      if (router && typeof router.canGoBack === 'function') {
        return router.canGoBack();
      }
      return false;
    }
  };
  
  return safeRouter;
};

export default function Categories() {
  const router = useSafeRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen 
        options={{
          title: "Categories",
          headerLeft: () => (
            <IconButton 
              icon="arrow-left"
              onPress={() => router.back()}
            />
          ),
        }} 
      />
      <View style={styles.container}>
        <CategoryGrid />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
});