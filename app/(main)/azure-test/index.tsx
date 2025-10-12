import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import AzureAITest from '../../../components/test/AzureAITest';

const AzureTestScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <AzureAITest />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

export default AzureTestScreen;