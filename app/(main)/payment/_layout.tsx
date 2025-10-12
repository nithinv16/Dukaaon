import React from 'react';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { IconButton } from 'react-native-paper';

export default function PaymentLayout() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = params.returnTo;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal'
      }}
    >
      <Stack.Screen 
        name="methods" 
        options={{
          title: 'Payment Methods',
          headerRight: () => (
            <IconButton
              icon="plus"
              onPress={() => {
                if (returnTo) {
                  router.push(`/(main)/payment/add?returnTo=${returnTo}`);
                } else {
                  router.push('/(main)/payment/add');
                }
              }}
            />
          ),
        }}
      />
      <Stack.Screen 
        name="add" 
        options={{
          title: 'Add Payment Method',
        }}
      />
    </Stack>
  );
} 