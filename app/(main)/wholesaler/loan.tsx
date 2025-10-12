import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, BackHandler } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../../components/SystemStatusBar';

export default function LoanScreen() {
  const router = useRouter();

  // Handle back button navigation for wholesaler loan screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Navigate back to the previous screen instead of exiting the app
      if (router.canGoBack()) {
        router.back();
        return true; // Prevent default behavior
      } else {
        // If we can't go back, navigate to wholesaler home screen
        router.replace('/(main)/wholesaler');
        return true; // Prevent default behavior
      }
    });

    return () => backHandler.remove();
  }, [router]);

  return (
    <View style={styles.container}>
      <SystemStatusBar style="dark" />
      
      <View style={styles.header}>
        <Text variant="headlineMedium">Business Loans</Text>
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Available Loan Options</Text>
            {/* Add loan options here */}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
});