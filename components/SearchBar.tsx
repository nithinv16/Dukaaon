import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Searchbar, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';

interface SearchBarProps {
  placeholder?: string;
}

export function SearchBar({ placeholder = 'Search...' }: SearchBarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/(main)/screens/search?query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder={placeholder}
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={handleSearch}
        style={styles.searchBar}
        clearButtonMode="while-editing"
        icon="magnify"
      />
      <IconButton 
        icon="microphone" 
        size={24} 
        onPress={handleSearch}
        style={styles.voiceButton}
        iconColor="#FF7D00"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingTop: 0,
    backgroundColor: '#fff',
  },
  searchBar: {
    flex: 1,
    borderRadius: 20,
    elevation: 1,
  },
  voiceButton: {
    marginLeft: 4,
  },
}); 