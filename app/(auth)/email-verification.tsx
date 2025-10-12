import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';

export default function EmailVerification() {
  const router = useRouter();
  const { email } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <SystemStatusBar style="dark" />
      
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Check Your Email
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          We've sent a verification link to:
        </Text>
        <Text variant="bodyLarge" style={styles.email}>
          {email}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.instructions}>
          Please check your email and click the verification link to continue.
          Once verified, you can return to the app and proceed with your registration.
        </Text>

        <Button
          mode="contained"
          onPress={() => router.push('/(auth)/login')}
          style={styles.button}
        >
          Return to Login
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  email: {
    marginTop: 8,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 100,
  },
  instructions: {
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    opacity: 0.7,
  },
  button: {
    marginTop: 20,
  },
}); 