import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

export default function LoanScreen() {
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('');
  const [interest, setInterest] = useState('');
  const [dailyRepayment, setDailyRepayment] = useState('');

  const calculateLoan = () => {
    const isShortTerm = tenure < 30;
    const rate = isShortTerm ? 15 : 13;
    const processingFee = 2;
    const principal = parseFloat(amount);
    const totalInterest = (principal * rate * tenure) / (100 * 365);
    const totalRepayment = principal + totalInterest + (principal * processingFee) / 100;
    const dailyPayment = totalRepayment / tenure;
    setInterest(rate);
    setDailyRepayment(dailyPayment.toFixed(2));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Apply for a Loan</Text>
      <TextInput
        style={styles.input}
        placeholder="Loan Amount"
        keyboardType="numeric"
        onChangeText={(value) => setAmount(value)}
      />
      <TextInput
        style={styles.input}
        placeholder="Tenure (in days)"
        keyboardType="numeric"
        onChangeText={(value) => setTenure(value)}
      />
      <Button title="Calculate Loan" onPress={calculateLoan} color="#FF6B35" />
      <Text style={styles.result}>Interest Rate: {interest}%</Text>
      <Text style={styles.result}>Daily Repayment: ₹{dailyRepayment}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    padding: 20,
  },
  title: {
    fontSize: 24,
    color: '#FF6B35',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BDBDBD',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginVertical: 10,
  },
  result: {
    fontSize: 16,
    color: '#4F4F4F',
    marginVertical: 10,
  },
});
// JavaScript source code
