import React from 'react';
import { Stack } from 'expo-router';

/**
 * Layout for the loans section screens
 * This specifically disables gesture navigation for the index/main loans screen
 * while allowing it for other screens within this section
 */
export default function LoansLayout() {
  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        // Only disable gesture for the index page (main loans screen)
        gestureEnabled: route.name !== 'index'
      })}
    />
  );
} 