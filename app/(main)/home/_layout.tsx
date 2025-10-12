import React from 'react';
import { Stack } from 'expo-router';

/**
 * Layout for the home section screens
 * This specifically disables gesture navigation for the index/home screen
 * while allowing it for other screens within the home section
 */
export default function HomeLayout() {
  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        // Only disable gesture for the index page (main home screen)
        gestureEnabled: route.name !== 'index'
      })}
    />
  );
} 