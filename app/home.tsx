import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, Redirect } from 'expo-router';

export default function DirectHome() {
  const router = useRouter();

  useEffect(() => {
    // Attempt direct navigation to the proper home screen
    console.log('Direct home route: redirecting to proper home screen');
    
    // Using a timeout to let screen mount first
    const timer = setTimeout(() => {
      router.replace('/(main)/home/');
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF7D00" />
      <Text style={styles.text}>Loading home screen...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
});