import React from 'react';
import { Stack } from 'expo-router';

/**
 * Layout for the stock sharing section screens
 * This specifically disables gesture navigation for the index/main stock screen
 * while allowing it for other screens within this section
 */
export default function StockLayout() {
  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        // Only disable gesture for the index page (main stock screen)
        gestureEnabled: route.name !== 'index'
      })}
    />
  );
} 