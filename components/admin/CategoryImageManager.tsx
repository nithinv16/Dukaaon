import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { categoryImageService } from '../../services/categoryImageService';

interface CategoryMapping {
  id: number;
  category_name: string;
  image_url: string | null;
  fallback_category: string | null;
  is_active: boolean;
}

export const CategoryImageManager: React.FC = () => {
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    setLoading(true);
    try {
      const data = await categoryImageService.getAllCategoryMappings();
      setMappings(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load category mappings');
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = async () => {
    try {
      await categoryImageService.initializeCategoryMappings();
      Alert.alert('Success', 'Default category mappings initialized');
      loadMappings();
    } catch (error) {
      Alert.alert('Error', 'Failed to initialize mappings');
    }
  };

  const renderMapping = ({ item }: { item: CategoryMapping }) => (
    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
      <Text style={{ fontWeight: 'bold' }}>{item.category_name}</Text>
      <Text>Image: {item.image_url || 'None'}</Text>
      <Text>Fallback: {item.fallback_category || 'None'}</Text>
      <Text>Status: {item.is_active ? 'Active' : 'Inactive'}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
        Category Image Manager
      </Text>
      
      <TouchableOpacity
        onPress={initializeDefaults}
        style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginBottom: 16 }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
          Initialize Default Mappings
        </Text>
      </TouchableOpacity>

      <FlatList
        data={mappings}
        renderItem={renderMapping}
        keyExtractor={(item) => item.id.toString()}
        refreshing={loading}
        onRefresh={loadMappings}
      />
    </View>
  );
};