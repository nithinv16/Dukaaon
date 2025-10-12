import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase/supabase';

export default function VerifyScreen() {
  const [otp, setOtp] = React.useState('');
  const router = useRouter();

  const handleVerify = async () => {
    try {
      // TODO: Implement OTP verification with Supabase
      // const { data, error } = await supabase.auth.verifyOtp({...})
      
      // Temporarily navigate to home
      router.replace('/(main)/home/');
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Verify Phone</Text>
      <TextInput
        mode="outlined"
        label="Enter OTP"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        style={styles.input}
        maxLength={6}
      />
      <Button
        mode="contained"
        onPress={handleVerify}
        style={styles.button}
      >
        Verify
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    marginBottom: 40,
  },
  input: {
    width: '100%',
    maxWidth: 300,
    marginBottom: 20,
  },
  button: {
    width: '100%',
    maxWidth: 300,
    paddingVertical: 8,
  },
});