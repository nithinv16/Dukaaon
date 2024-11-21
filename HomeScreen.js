import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Essential Goods</Text>
      <Image
        source={{ uri: 'https://via.placeholder.com/150' }}
        style={styles.image}
      />
      <Text style={styles.subtitle}>Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  image: {
    width: 200,
    height: 200,
    marginVertical: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#4F4F4F',
  },
});
// JavaScript source code
