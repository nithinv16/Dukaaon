import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Chip } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../services/supabase/supabase';

export default function WholesalerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // UUID validation regex
  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  useEffect(() => {
    // Validate ID parameter before making database calls
    if (!id || !isValidUUID(id)) {
      console.error('Invalid UUID parameter:', id);
      // Redirect back to wholesaler home if invalid ID
      router.replace('/(main)/wholesaler');
      return;
    }
    fetchInventory();
  }, [id]);

  const fetchInventory = async () => {
    try {
      // Double-check UUID validity before database call
      if (!id || !isValidUUID(id)) {
        throw new Error('Invalid UUID parameter');
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', id);

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  // ... render inventory items ...
}