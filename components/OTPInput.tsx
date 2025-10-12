import React, { useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';

interface OTPInputProps {
  value: string;
  onChangeText: (text: string) => void;
  length: number;
  autoFocus?: boolean;
}

const { width } = Dimensions.get('window');
const inputWidth = Math.min((width - 120) / 6, 50);

export const OTPInput: React.FC<OTPInputProps> = ({
  value,
  onChangeText,
  length,
  autoFocus = false,
}) => {
  const theme = useTheme();
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChangeText = (text: string, index: number) => {
    // Only allow numeric input
    const numericText = text.replace(/[^0-9]/g, '');
    
    if (numericText.length <= 1) {
      const newValue = value.split('');
      newValue[index] = numericText;
      const updatedValue = newValue.join('').slice(0, length);
      onChangeText(updatedValue);

      // Auto-focus next input
      if (numericText && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !value[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '').slice(0, length);
    onChangeText(numericText);
    
    // Focus the next empty input or the last input
    const nextIndex = Math.min(numericText.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }, (_, index) => (
        <TextInput
          key={index}
          ref={(ref) => (inputRefs.current[index] = ref)}
          style={[
            styles.input,
            {
              borderColor: value[index] ? theme.colors.primary : theme.colors.outline,
              backgroundColor: theme.colors.surface,
              color: theme.colors.onSurface,
            },
          ]}
          value={value[index] || ''}
          onChangeText={(text) => handleChangeText(text, index)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
          keyboardType="numeric"
          maxLength={1}
          textAlign="center"
          selectTextOnFocus
          onFocus={() => {
            // Select all text when focused
            if (value[index]) {
              inputRefs.current[index]?.setSelection(0, 1);
            }
          }}
          // Handle paste on first input
          onPaste={index === 0 ? (event) => {
            event.preventDefault();
            const pastedText = event.nativeEvent.text || '';
            handlePaste(pastedText);
          } : undefined}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  input: {
    width: inputWidth,
    height: inputWidth,
    borderWidth: 2,
    borderRadius: 8,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});