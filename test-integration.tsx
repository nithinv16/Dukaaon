/**
 * Translation Reload Test Integration Component
 * 
 * This component integrates the translation reload tests into the React Native app
 * to verify that the functionality works correctly in the actual app context.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Button } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage, useTranslation } from './contexts/LanguageContext';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

export default function TranslationReloadTestIntegration() {
  const { currentLanguage, changeLanguage, reloadTranslationsFromCache } = useLanguage();
  const { tSync } = useTranslation();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState('');

  // Test languages to cycle through
  const testLanguages = [
    { code: 'hi', name: 'Hindi' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'en', name: 'English' }
  ];

  /**
   * Test 1: Verify AsyncStorage contains cached translations
   */
  const testAsyncStorageCache = async (): Promise<TestResult> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const translationKeys = keys.filter(key => key.startsWith('translations_'));
      
      if (translationKeys.length > 0) {
        // Check if at least one cache entry has valid data
        for (const key of translationKeys) {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.translations && Object.keys(parsed.translations).length > 0) {
              return {
                name: 'AsyncStorage Cache',
                passed: true,
                details: `Found ${translationKeys.length} cached languages`
              };
            }
          }
        }
      }
      
      return {
        name: 'AsyncStorage Cache',
        passed: false,
        details: 'No valid cached translations found'
      };
    } catch (error) {
      return {
        name: 'AsyncStorage Cache',
        passed: false,
        details: `Error: ${error.message}`
      };
    }
  };

  /**
   * Test 2: Test language change and component re-render
   */
  const testLanguageChangeRerender = async (): Promise<TestResult> => {
    try {
      const originalLanguage = currentLanguage;
      const testLanguage = originalLanguage === 'en' ? 'hi' : 'en';
      
      // Get initial translation
      const initialTitle = tSync('login.welcome_title', 'Welcome to DukaaOn');
      
      // Change language
      await changeLanguage(testLanguage, testLanguage);
      
      // Wait a moment for state update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get new translation
      const newTitle = tSync('login.welcome_title', 'Welcome to DukaaOn');
      
      // Restore original language
      await changeLanguage(originalLanguage, originalLanguage);
      
      const changed = initialTitle !== newTitle;
      
      return {
        name: 'Language Change Re-render',
        passed: changed,
        details: changed ? 'Component re-rendered with new translations' : 'No change detected'
      };
    } catch (error) {
      return {
        name: 'Language Change Re-render',
        passed: false,
        details: `Error: ${error.message}`
      };
    }
  };

  /**
   * Test 3: Test reloadTranslationsFromCache function
   */
  const testReloadFunction = async (): Promise<TestResult> => {
    try {
      // Call the reload function
      await reloadTranslationsFromCache();
      
      // Verify translations are still accessible
      const title = tSync('login.welcome_title');
      const subtitle = tSync('login.welcome_subtitle');
      const continueBtn = tSync('login.continue');
      
      const hasTranslations = title && subtitle && continueBtn;
      
      return {
        name: 'Reload Translations Function',
        passed: hasTranslations,
        details: hasTranslations ? 'Translations reloaded successfully' : 'Missing translations after reload'
      };
    } catch (error) {
      return {
        name: 'Reload Translations Function',
        passed: false,
        details: `Error: ${error.message}`
      };
    }
  };

  /**
   * Test 4: Test translation consistency across language changes
   */
  const testTranslationConsistency = async (): Promise<TestResult> => {
    try {
      const results = [];
      
      for (const lang of testLanguages) {
        await changeLanguage(lang.code, lang.code);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const title = tSync('login.welcome_title');
        const hasTranslation = title && title.trim() !== '';
        
        results.push({
          language: lang.name,
          hasTranslation,
          title: title?.substring(0, 30) + '...'
        });
      }
      
      const allHaveTranslations = results.every(r => r.hasTranslation);
      
      return {
        name: 'Translation Consistency',
        passed: allHaveTranslations,
        details: `${results.filter(r => r.hasTranslation).length}/${results.length} languages have translations`
      };
    } catch (error) {
      return {
        name: 'Translation Consistency',
        passed: false,
        details: `Error: ${error.message}`
      };
    }
  };

  /**
   * Run all tests
   */
  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    const tests = [
      { name: 'AsyncStorage Cache', fn: testAsyncStorageCache },
      { name: 'Language Change Re-render', fn: testLanguageChangeRerender },
      { name: 'Reload Function', fn: testReloadFunction },
      { name: 'Translation Consistency', fn: testTranslationConsistency }
    ];
    
    const results: TestResult[] = [];
    
    for (const test of tests) {
      setCurrentTest(test.name);
      try {
        const result = await test.fn();
        results.push(result);
        setTestResults([...results]);
      } catch (error) {
        results.push({
          name: test.name,
          passed: false,
          details: `Unexpected error: ${error.message}`
        });
        setTestResults([...results]);
      }
    }
    
    setCurrentTest('');
    setIsRunning(false);
    
    // Show summary
    const passedCount = results.filter(r => r.passed).length;
    Alert.alert(
      'Test Results',
      `${passedCount}/${results.length} tests passed\n\n${results.map(r => 
        `${r.passed ? '✅' : '❌'} ${r.name}`
      ).join('\n')}`,
      [{ text: 'OK' }]
    );
  };

  /**
   * Clear translation cache for testing
   */
  const clearTranslationCache = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const translationKeys = keys.filter(key => key.startsWith('translations_'));
      if (translationKeys.length > 0) {
        await AsyncStorage.multiRemove(translationKeys);
        Alert.alert('Success', 'Translation cache cleared');
      } else {
        Alert.alert('Info', 'No translation cache found');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to clear cache: ${error.message}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Translation Reload Test</Text>
        <Text style={styles.subtitle}>
          Current Language: {currentLanguage}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sample Translations:</Text>
        <Text style={styles.translationText}>
          Title: {tSync('login.welcome_title', 'Welcome to DukaaOn')}
        </Text>
        <Text style={styles.translationText}>
          Subtitle: {tSync('login.welcome_subtitle', 'Login or create account')}
        </Text>
        <Text style={styles.translationText}>
          Continue: {tSync('login.continue', 'Continue')}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Language Test:</Text>
        <View style={styles.languageButtons}>
          {testLanguages.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.langButton,
                currentLanguage === lang.code && styles.activeLangButton
              ]}
              onPress={() => changeLanguage(lang.code, lang.code)}
            >
              <Text style={[
                styles.langButtonText,
                currentLanguage === lang.code && styles.activeLangButtonText
              ]}>
                {lang.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Button
          mode="contained"
          onPress={runAllTests}
          loading={isRunning}
          disabled={isRunning}
          style={styles.testButton}
        >
          {isRunning ? `Running: ${currentTest}` : 'Run All Tests'}
        </Button>

        <Button
          mode="outlined"
          onPress={clearTranslationCache}
          disabled={isRunning}
          style={styles.clearButton}
        >
          Clear Translation Cache
        </Button>
      </View>

      {testResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results:</Text>
          {testResults.map((result, index) => (
            <View key={index} style={styles.testResult}>
              <Text style={[
                styles.testName,
                { color: result.passed ? '#4CAF50' : '#F44336' }
              ]}>
                {result.passed ? '✅' : '❌'} {result.name}
              </Text>
              {result.details && (
                <Text style={styles.testDetails}>{result.details}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  translationText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  languageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 16,
  },
  activeLangButton: {
    backgroundColor: '#2196F3',
  },
  langButtonText: {
    fontSize: 12,
    color: '#333',
  },
  activeLangButtonText: {
    color: 'white',
  },
  testButton: {
    marginBottom: 12,
  },
  clearButton: {
    marginBottom: 12,
  },
  testResult: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  testName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  testDetails: {
    fontSize: 14,
    color: '#666',
  },
});