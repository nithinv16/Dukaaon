import React from 'react';
import { Stack } from 'expo-router';
import CartIcon from '../../../components/CartIcon';

export default function ScreenLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
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
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="manufacturer/[id]" 
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="sellers/index" 
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="product/[id]" 
        options={{
          headerShown: true,
          title: 'Product Details',
          headerBackTitle: 'Back'
        }}
      />
    </Stack>
  );
} 