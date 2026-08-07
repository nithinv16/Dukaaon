import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        header: () => null,
        navigationBarHidden: true,
        statusBarHidden: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
} 