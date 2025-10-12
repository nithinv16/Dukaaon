import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import { BusinessDetails } from '../../types/kyc';

interface BusinessFormProps {
  values: BusinessDetails;
  onChange: (values: BusinessDetails) => void;
  errors: Partial<Record<keyof BusinessDetails, string>>;
}

export function BusinessForm({ values, onChange, errors }: BusinessFormProps) {
  const handleChange = (field: keyof BusinessDetails, value: string) => {
    if (field === 'address') {
      const [key, val] = value.split(':');
      onChange({
        ...values,
        address: {
          ...values.address,
          [key]: val,
        },
      });
    } else {
      onChange({
        ...values,
        [field]: value,
      });
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        mode="outlined"
        label="Shop Name"
        value={values.shopName}
        onChangeText={(value) => handleChange('shopName', value)}
        error={!!errors.shopName}
      />
      {errors.shopName && <HelperText type="error">{errors.shopName}</HelperText>}

      <TextInput
        mode="outlined"
        label="Street Address"
        value={values.address.street}
        onChangeText={(value) => handleChange('address', `street:${value}`)}
        error={!!errors.address}
        style={styles.input}
      />

      <TextInput
        mode="outlined"
        label="City"
        value={values.address.city}
        onChangeText={(value) => handleChange('address', `city:${value}`)}
        error={!!errors.address}
        style={styles.input}
      />

      <TextInput
        mode="outlined"
        label="State"
        value={values.address.state}
        onChangeText={(value) => handleChange('address', `state:${value}`)}
        error={!!errors.address}
        style={styles.input}
      />

      <TextInput
        mode="outlined"
        label="PIN Code"
        value={values.address.pincode}
        onChangeText={(value) => handleChange('address', `pincode:${value}`)}
        keyboardType="number-pad"
        error={!!errors.address}
        style={styles.input}
      />
      {errors.address && <HelperText type="error">{errors.address}</HelperText>}

      <TextInput
        mode="outlined"
        label="GSTIN (Optional)"
        value={values.gstin}
        onChangeText={(value) => handleChange('gstin', value)}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  input: {
    marginTop: 12,
  },
});