import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Slider, TextInput, Divider, DataTable, IconButton } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { calculateDeliveryFee, getDeliveryFeeExamples } from '../../../services/delivery/deliveryCalculation';

export default function DeliveryPricing() {
  const router = useRouter();
  const [distance, setDistance] = useState(10);
  const [orderValue, setOrderValue] = useState(5000);
  const [deliveryInfo, setDeliveryInfo] = useState(() => calculateDeliveryFee(10, 5000));
  const examples = getDeliveryFeeExamples();

  const handleDistanceChange = (value: number) => {
    setDistance(value);
    updateDeliveryInfo(value, orderValue);
  };

  const handleOrderValueChange = (text: string) => {
    const value = parseInt(text.replace(/[^0-9]/g, '')) || 0;
    setOrderValue(value);
    updateDeliveryInfo(distance, value);
  };

  const updateDeliveryInfo = (dist: number, value: number) => {
    const info = calculateDeliveryFee(dist, value);
    setDeliveryInfo(info);
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Delivery Price Calculator',
          headerLeft: () => (
            <IconButton icon="arrow-left" onPress={() => router.back()} />
          ),
        }}
      />

      <ScrollView style={styles.scrollView}>
        <Card style={styles.mainCard}>
          <Card.Title title="Dynamic Delivery Fee Calculator" />
          <Card.Content>
            <Text style={styles.label}>Distance: {distance.toFixed(1)} km</Text>
            <Slider
              value={distance}
              onValueChange={handleDistanceChange}
              minimumValue={1}
              maximumValue={25}
              step={0.5}
              style={styles.slider}
            />

            <Text style={styles.label}>Order Value:</Text>
            <TextInput
              mode="outlined"
              value={orderValue.toString()}
              onChangeText={handleOrderValueChange}
              left={<TextInput.Affix text="₹" />}
              keyboardType="numeric"
              style={styles.input}
            />

            <Divider style={styles.divider} />

            <View style={styles.resultContainer}>
              <Text variant="headlineSmall" style={styles.resultTitle}>
                Delivery Fee: {formatCurrency(deliveryInfo.fee)}
              </Text>
              <Text style={styles.resultDetail}>
                Vehicle Type: {deliveryInfo.vehicleType}
              </Text>
              <Text style={styles.resultDetail}>
                Maximum Fee Cap: {deliveryInfo.maxPercentage} of order value
              </Text>
              <Text style={styles.resultDetail}>
                ({formatCurrency(Math.round(orderValue * parseInt(deliveryInfo.maxPercentage) / 100))})
              </Text>
              <Text style={styles.resultDetail}>
                Fee as percentage of order: {(deliveryInfo.fee / orderValue * 100).toFixed(2)}%
              </Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.examplesCard}>
          <Card.Title title="Example Delivery Fees" />
          <Card.Content>
            <Text style={styles.exampleText}>
              Our pricing algorithm balances distance and order value to calculate fair delivery fees.
              Here are some example scenarios:
            </Text>

            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Distance</DataTable.Title>
                <DataTable.Title>Order Value</DataTable.Title>
                <DataTable.Title numeric>Fee</DataTable.Title>
                <DataTable.Title>Vehicle</DataTable.Title>
              </DataTable.Header>

              {examples.map((example, index) => (
                <DataTable.Row key={index}>
                  <DataTable.Cell>{example.distance} km</DataTable.Cell>
                  <DataTable.Cell>{formatCurrency(example.orderValue)}</DataTable.Cell>
                  <DataTable.Cell numeric>{formatCurrency(example.fee)}</DataTable.Cell>
                  <DataTable.Cell>{example.vehicleType}</DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>

            <Text style={styles.noteText}>
              Note: For orders at ₹1,000 and 10km distance, the delivery fee is ₹100,
              matching our target price point.
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.howItWorksCard}>
          <Card.Title title="How It Works" />
          <Card.Content>
            <Text style={styles.paragraphText}>
              Our algorithm considers multiple factors to ensure fair pricing:
            </Text>
            
            <Text style={styles.bulletPoint}>• Vehicle selection based on order size</Text>
            <Text style={styles.bulletPoint}>• Distance-based calculation with exponential scaling</Text>
            <Text style={styles.bulletPoint}>• Sliding percentage caps (5-10%) based on order value</Text>
            <Text style={styles.bulletPoint}>• Guaranteed minimum payments for delivery partners</Text>
            <Text style={styles.bulletPoint}>• Order batching for more efficient deliveries</Text>
            
            <Text style={styles.paragraphText}>
              This ensures delivery partners receive fair compensation while keeping delivery 
              affordable for customers across all order sizes.
            </Text>
          </Card.Content>
        </Card>
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  mainCard: {
    margin: 16,
    elevation: 2,
  },
  examplesCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  howItWorksCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
  },
  slider: {
    height: 40,
  },
  input: {
    marginTop: 8,
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  resultContainer: {
    padding: 16,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    alignItems: 'center',
  },
  resultTitle: {
    marginBottom: 8,
    color: '#2196F3',
  },
  resultDetail: {
    marginVertical: 4,
    textAlign: 'center',
  },
  exampleText: {
    marginBottom: 16,
  },
  noteText: {
    marginTop: 16,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  paragraphText: {
    marginVertical: 8,
    lineHeight: 20,
  },
  bulletPoint: {
    marginLeft: 8,
    marginVertical: 4,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 40,
  },
}); 