import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function EmailInput({ value, onChange, error }: EmailInputProps) {
  return (
    <View style={styles.container}>
      <TextInput
        mode="outlined"
        label="Email Address"
        value={value}
        onChangeText={onChange}
        keyboardType="email-address"
        autoCapitalize="none"
        error={!!error}
      />
      {error && <HelperText type="error">{error}</HelperText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
}); 