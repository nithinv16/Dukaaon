import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCategoryTranslation } from '../../hooks/useCategoryTranslation';

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'pending';
  message: string;
}

const TranslationSystemTest: React.FC = () => {
  const { currentLanguage, changeLanguage, translate } = useLanguage();
  const { translateCategoryOrSubcategory, translateCategory, translateSubcategory } = useCategoryTranslation();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const testCategories = [
    'baby_care',
    'beauty_personal_care', 
    'beverages',
    'dairy_eggs',
    'fruits_vegetables'
  ];

  const testSubcategories = [
    'baby_food',
    'skincare',
    'tea_coffee',
    'milk',
    'juices'
  ];

  const supportedLanguages = ['en', 'hi', 'ml'];

  const runTests = async () => {
    setIsRunning(true);
    const results: TestResult[] = [];

    // Test 1: Basic translation functionality
    try {
      const englishTranslation = translateCategory('baby_care');
      results.push({
        test: 'Basic Category Translation (English)',
        status: englishTranslation ? 'pass' : 'fail',
        message: `Translated 'baby_care' to: ${englishTranslation}`
      });
    } catch (error) {
      results.push({
        test: 'Basic Category Translation (English)',
        status: 'fail',
        message: `Error: ${error}`
      });
    }

    // Test 2: Subcategory translation
    try {
      const subcategoryTranslation = translateSubcategory('baby_food');
      results.push({
        test: 'Basic Subcategory Translation',
        status: subcategoryTranslation ? 'pass' : 'fail',
        message: `Translated 'baby_food' to: ${subcategoryTranslation}`
      });
    } catch (error) {
      results.push({
        test: 'Basic Subcategory Translation',
        status: 'fail',
        message: `Error: ${error}`
      });
    }

    // Test 3: Multi-language support
    for (const lang of supportedLanguages) {
      try {
        await changeLanguage(lang as any);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for language change
        
        const categoryTranslation = translateCategory('beverages');
        const subcategoryTranslation = translateSubcategory('tea_coffee');
        
        results.push({
          test: `Language Support (${lang.toUpperCase()})`,
          status: (categoryTranslation && subcategoryTranslation) ? 'pass' : 'fail',
          message: `Category: ${categoryTranslation}, Subcategory: ${subcategoryTranslation}`
        });
      } catch (error) {
        results.push({
          test: `Language Support (${lang.toUpperCase()})`,
          status: 'fail',
          message: `Error: ${error}`
        });
      }
    }

    // Test 4: Fallback behavior for unknown keys
    try {
      const unknownCategory = translateCategory('unknown_category');
      results.push({
        test: 'Fallback for Unknown Category',
        status: unknownCategory === 'unknown_category' ? 'pass' : 'fail',
        message: `Unknown category returned: ${unknownCategory}`
      });
    } catch (error) {
      results.push({
        test: 'Fallback for Unknown Category',
        status: 'fail',
        message: `Error: ${error}`
      });
    }

    // Test 5: Combined category/subcategory translation
    try {
      const combinedTranslation = translateCategoryOrSubcategory('dairy_eggs');
      results.push({
        test: 'Combined Category/Subcategory Translation',
        status: combinedTranslation ? 'pass' : 'fail',
        message: `Translated 'dairy_eggs' to: ${combinedTranslation}`
      });
    } catch (error) {
      results.push({
        test: 'Combined Category/Subcategory Translation',
        status: 'fail',
        message: `Error: ${error}`
      });
    }

    // Test 6: All predefined categories
    let allCategoriesPass = true;
    const categoryResults: string[] = [];
    
    for (const category of testCategories) {
      try {
        const translation = translateCategory(category);
        if (!translation || translation === category) {
          allCategoriesPass = false;
        }
        categoryResults.push(`${category}: ${translation}`);
      } catch (error) {
        allCategoriesPass = false;
        categoryResults.push(`${category}: ERROR`);
      }
    }

    results.push({
      test: 'All Predefined Categories',
      status: allCategoriesPass ? 'pass' : 'fail',
      message: categoryResults.join(', ')
    });

    // Test 7: All predefined subcategories
    let allSubcategoriesPass = true;
    const subcategoryResults: string[] = [];
    
    for (const subcategory of testSubcategories) {
      try {
        const translation = translateSubcategory(subcategory);
        if (!translation || translation === subcategory) {
          allSubcategoriesPass = false;
        }
        subcategoryResults.push(`${subcategory}: ${translation}`);
      } catch (error) {
        allSubcategoriesPass = false;
        subcategoryResults.push(`${subcategory}: ERROR`);
      }
    }

    results.push({
      test: 'All Predefined Subcategories',
      status: allSubcategoriesPass ? 'pass' : 'fail',
      message: subcategoryResults.join(', ')
    });

    setTestResults(results);
    setIsRunning(false);

    // Show summary
    const passCount = results.filter(r => r.status === 'pass').length;
    const totalCount = results.length;
    
    Alert.alert(
      'Test Results',
      `${passCount}/${totalCount} tests passed`,
      [{ text: 'OK' }]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return '#4CAF50';
      case 'fail': return '#F44336';
      default: return '#FF9800';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Translation System Test</Text>
        <Text style={styles.subtitle}>Current Language: {currentLanguage.toUpperCase()}</Text>
        
        <TouchableOpacity 
          style={[styles.button, isRunning && styles.buttonDisabled]} 
          onPress={runTests}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.languageSelector}>
        <Text style={styles.sectionTitle}>Quick Language Test:</Text>
        <View style={styles.languageButtons}>
          {supportedLanguages.map(lang => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.langButton,
                currentLanguage === lang && styles.activeLangButton
              ]}
              onPress={() => changeLanguage(lang as any)}
            >
              <Text style={[
                styles.langButtonText,
                currentLanguage === lang && styles.activeLangButtonText
              ]}>
                {lang.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.quickTest}>
        <Text style={styles.sectionTitle}>Quick Translation Preview:</Text>
        <View style={styles.previewItem}>
          <Text style={styles.previewLabel}>Category (baby_care):</Text>
          <Text style={styles.previewValue}>{translateCategory('baby_care')}</Text>
        </View>
        <View style={styles.previewItem}>
          <Text style={styles.previewLabel}>Subcategory (tea_coffee):</Text>
          <Text style={styles.previewValue}>{translateSubcategory('tea_coffee')}</Text>
        </View>
      </View>

      {testResults.length > 0 && (
        <View style={styles.results}>
          <Text style={styles.sectionTitle}>Test Results:</Text>
          {testResults.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <View style={styles.resultHeader}>
                <Text style={styles.testName}>{result.test}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(result.status) }]}>
                  <Text style={styles.statusText}>{result.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.resultMessage}>{result.message}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  languageSelector: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  langButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  activeLangButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  langButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  activeLangButtonText: {
    color: '#fff',
  },
  quickTest: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  results: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },
  resultItem: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default TranslationSystemTest;