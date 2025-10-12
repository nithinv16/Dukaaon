import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, IconButton, List } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Licenses() {
  const router = useRouter();

  // List of open source libraries used in the app
  const licenses = [
    {
      name: 'Expo',
      version: '^50.0.0',
      license: 'MIT',
      url: 'https://github.com/expo/expo',
    },
    {
      name: 'React Native',
      version: '0.73.2',
      license: 'MIT',
      url: 'https://github.com/facebook/react-native',
    },
    {
      name: 'React Native Paper',
      version: '^5.12.1',
      license: 'MIT',
      url: 'https://github.com/callstack/react-native-paper',
    },
    {
      name: 'Expo Router',
      version: '^3.4.6',
      license: 'MIT',
      url: 'https://github.com/expo/router',
    },
    {
      name: 'Zustand',
      version: '^4.5.0',
      license: 'MIT',
      url: 'https://github.com/pmndrs/zustand',
    },
    {
      name: 'Supabase JS',
      version: '^2.39.3',
      license: 'MIT',
      url: 'https://github.com/supabase/supabase-js',
    },
    {
      name: 'Firebase',
      version: '^10.7.2',
      license: 'Apache-2.0',
      url: 'https://github.com/firebase/firebase-js-sdk',
    },
    {
      name: 'React Native Safe Area Context',
      version: '4.8.2',
      license: 'MIT',
      url: 'https://github.com/th3rdwave/react-native-safe-area-context',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          size={24}
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>Open Source Licenses</Text>
        <View style={{width: 40}} />
      </View>
      
      <ScrollView style={styles.container}>
        <Text style={styles.paragraph}>
          DukaaOn uses several open source libraries. We're grateful to the developers who have contributed to these projects.
        </Text>
        
        {licenses.map((lib, index) => (
          <List.Item
            key={index}
            title={`${lib.name} (${lib.version})`}
            description={`License: ${lib.license}`}
            left={props => <List.Icon {...props} icon="code-tags" />}
            style={styles.listItem}
          />
        ))}
        
        <Text style={styles.paragraph}>
          Full license texts can be found at the respective project websites or GitHub repositories.
        </Text>
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#444',
    marginVertical: 16,
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bottomPadding: {
    height: 60,
  },
}); 