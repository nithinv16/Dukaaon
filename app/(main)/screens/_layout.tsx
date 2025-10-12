import React from 'react';
import { Stack } from 'expo-router';

export default function ScreenLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="categories" />
      <Stack.Screen name="search" />
      <Stack.Screen 
        name="category/[id]" 
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="wholesaler/[id]" 
        options={{
          title: "Wholesaler Profile",
          headerShown: true
        }}
      />
      <Stack.Screen 
        name="manufacturer/[id]" 
        options={{
          title: "Manufacturer Profile",
          headerShown: true
        }}
      />
    </Stack>
  );
} 