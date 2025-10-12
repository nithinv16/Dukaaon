import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, ProgressBar, IconButton } from 'react-native-paper';
import { OrderStatus } from '../../types/orders';

interface OrderTrackingProps {
  status: OrderStatus;
  orderNumber: string;
  estimatedDelivery?: string;
}

const statusOrder: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered'
];

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Order Placed',
  confirmed: 'Order Confirmed',
  processing: 'Processing',
  shipped: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

export function OrderTracking({ status, orderNumber, estimatedDelivery }: OrderTrackingProps) {
  const currentStatusIndex = statusOrder.indexOf(status);
  const progress = currentStatusIndex >= 0 ? (currentStatusIndex + 1) / statusOrder.length : 0;

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium">Order #{orderNumber}</Text>
          <Text variant="bodySmall" style={styles.status}>
            {statusLabels[status]}
          </Text>
        </View>

        <ProgressBar 
          progress={progress} 
          color="#4CAF50"
          style={styles.progressBar}
        />

        <View style={styles.statusSteps}>
          {statusOrder.map((step, index) => (
            <View 
              key={step} 
              style={[
                styles.step,
                index <= currentStatusIndex && styles.activeStep
              ]}
            >
              <IconButton
                icon={index <= currentStatusIndex ? 'check-circle' : 'circle-outline'}
                size={24}
                iconColor={index <= currentStatusIndex ? '#4CAF50' : '#666'}
              />
              <Text 
                variant="bodySmall"
                style={[
                  styles.stepLabel,
                  index <= currentStatusIndex && styles.activeStepLabel
                ]}
              >
                {statusLabels[step]}
              </Text>
            </View>
          ))}
        </View>

        {estimatedDelivery && (
          <Text variant="bodySmall" style={styles.estimatedDelivery}>
            Estimated Delivery: {new Date(estimatedDelivery).toLocaleDateString()}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  status: {
    color: '#4CAF50',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  statusSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  step: {
    flex: 1,
    alignItems: 'center',
    opacity: 0.5,
  },
  activeStep: {
    opacity: 1,
  },
  stepLabel: {
    textAlign: 'center',
    fontSize: 10,
    color: '#666',
    marginTop: -8,
  },
  activeStepLabel: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  estimatedDelivery: {
    textAlign: 'center',
    marginTop: 16,
    color: '#666',
  },
}); 