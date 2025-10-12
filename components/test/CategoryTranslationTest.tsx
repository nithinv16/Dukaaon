import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Card, Chip, Divider } from 'react-native-paper';
import { useCategoryTranslation } from '../../hooks/useCategoryTranslation';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';

interface TestCategory {
  name: string;
  isCategory: boolean;
}

export default function CategoryTranslationTest() {
  const { translateCategoryOrSubcategory, translateCategory, translateSubcategory, translateMultiple } = useCategoryTranslation();
  const { currentLanguage, changeLanguage, availableLanguages } = useTranslation();
  
  const [testCategories, setTestCategories] = useState<TestCategory[]>([]);
  const [supabaseCategories, setSupabaseCategories] = useState<string[]>([]);
  const [supabaseSubcategories, setSupabaseSubcategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Predefined test data
  const predefinedTests: TestCategory[] = [
    { name: 'Baby Care', isCategory: true },
    { name: 'Beauty & Personal Care', isCategory: true },
    { name: 'Beverages', isCategory: true },
    { name: 'Baby Food', isCategory: false },
    { name: 'Skincare', isCategory: false },
    { name: 'Tea & Coffee', isCategory: false },
  ];

  useEffect(() => {
    setTestCategories(predefinedTests);
    fetchSupabaseData();
  }, []);

  const fetchSupabaseData = async () => {
    setIsLoading(true);
    try {
      // Fetch unique categories and subcategories from Supabase
      const { data: products, error } = await supabase
        .from('products')
        .select('category, subcategory')
        .limit(50);

      if (error) {
        console.error('Error fetching Supabase data:', error);
        Alert.alert('Error', 'Failed to fetch data from Supabase');
        return;
      }

      if (products) {
        const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
        const subcategories = [...new Set(products.map(p => p.subcategory).filter(Boolean))];
        
        setSupabaseCategories(categories);
        setSupabaseSubcategories(subcategories);
      }
    } catch (error) {
      console.error('Supabase fetch error:', error);
      Alert.alert('Error', 'Failed to connect to Supabase');
    } finally {
      setIsLoading(false);
    }
  };

  const testTranslation = (name: string, isCategory: boolean) => {
    const translated = translateCategoryOrSubcategory(name, isCategory);
    Alert.alert(
      'Translation Test',
      `Original: ${name}\nTranslated: ${translated}\nType: ${isCategory ? 'Category' : 'Subcategory'}`
    );
  };

  const testBatchTranslation = () => {
    const items = testCategories.map(cat => ({ name: cat.name, isCategory: cat.isCategory }));
    const translated = translateMultiple(items);
    
    const results = testCategories.map((cat, index) => 
      `${cat.name} → ${translated[index]} (${cat.isCategory ? 'Category' : 'Subcategory'})`
    ).join('\n');
    
    Alert.alert('Batch Translation Test', results);
  };

  const testSupabaseData = () => {
    if (supabaseCategories.length === 0 && supabaseSubcategories.length === 0) {
      Alert.alert('No Data', 'No Supabase data available. Try fetching first.');
      return;
    }

    const categoryResults = supabaseCategories.map(cat => 
      `${cat} → ${translateCategory(cat)}`
    );
    
    const subcategoryResults = supabaseSubcategories.map(subcat => 
      `${subcat} → ${translateSubcategory(subcat)}`
    );

    const allResults = [
      'CATEGORIES:',
      ...categoryResults,
      '',
      'SUBCATEGORIES:',
      ...subcategoryResults
    ].join('\n');

    Alert.alert('Supabase Data Translation', allResults);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Category Translation Test" />
        <Card.Content>
          <Text style={styles.subtitle}>Current Language: {currentLanguage}</Text>
          
          <View style={styles.languageButtons}>
            {availableLanguages.map((lang) => (
              <Chip
                key={lang.code}
                selected={currentLanguage === lang.code}
                onPress={() => changeLanguage(lang.code)}
                style={styles.languageChip}
              >
                {lang.name}
              </Chip>
            ))}
          </View>

          <Divider style={styles.divider} />

          <Text style={styles.sectionTitle}>Predefined Test Categories</Text>
          {testCategories.map((category, index) => (
            <View key={index} style={styles.testItem}>
              <Text style={styles.testText}>
                {category.name} ({category.isCategory ? 'Category' : 'Subcategory'})
              </Text>
              <Text style={styles.translatedText}>
                → {translateCategoryOrSubcategory(category.name, category.isCategory)}
              </Text>
              <Button
                mode="outlined"
                onPress={() => testTranslation(category.name, category.isCategory)}
                style={styles.testButton}
              >
                Test
              </Button>
            </View>
          ))}

          <Button
            mode="contained"
            onPress={testBatchTranslation}
            style={styles.actionButton}
          >
            Test Batch Translation
          </Button>

          <Divider style={styles.divider} />

          <Text style={styles.sectionTitle}>Supabase Data Test</Text>
          <Button
            mode="outlined"
            onPress={fetchSupabaseData}
            loading={isLoading}
            style={styles.actionButton}
          >
            Fetch Supabase Data
          </Button>

          {(supabaseCategories.length > 0 || supabaseSubcategories.length > 0) && (
            <>
              <Text style={styles.dataInfo}>
                Categories: {supabaseCategories.length}, Subcategories: {supabaseSubcategories.length}
              </Text>
              <Button
                mode="contained"
                onPress={testSupabaseData}
                style={styles.actionButton}
              >
                Test Supabase Translations
              </Button>
            </>
          )}

          <Divider style={styles.divider} />

          <Text style={styles.sectionTitle}>Sample Supabase Categories</Text>
          {supabaseCategories.slice(0, 5).map((category, index) => (
            <View key={index} style={styles.supabaseItem}>
              <Text style={styles.originalText}>{category}</Text>
              <Text style={styles.translatedText}>→ {translateCategory(category)}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Sample Supabase Subcategories</Text>
          {supabaseSubcategories.slice(0, 5).map((subcategory, index) => (
            <View key={index} style={styles.supabaseItem}>
              <Text style={styles.originalText}>{subcategory}</Text>
              <Text style={styles.translatedText}>→ {translateSubcategory(subcategory)}</Text>
            </View>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  languageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  languageChip: {
    margin: 4,
  },
  divider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  testItem: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  testText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  translatedText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  testButton: {
    alignSelf: 'flex-start',
  },
  actionButton: {
    marginVertical: 8,
  },
  dataInfo: {
    fontSize: 14,
    color: '#666',
    marginVertical: 8,
  },
  supabaseItem: {
    backgroundColor: '#f9f9f9',
    padding: 8,
    marginBottom: 4,
    borderRadius: 4,
  },
  originalText: {
    fontSize: 14,
    fontWeight: '500',
  },
});