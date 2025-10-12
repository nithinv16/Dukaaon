import React from 'react';
import { Stack } from 'expo-router';

/**
 * Layout for the phone-order section screens
 */
export default function PhoneOrderLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{
          title: 'Phone Order',
          headerShown: false
        }} 
      />
    </Stack>
  );
}