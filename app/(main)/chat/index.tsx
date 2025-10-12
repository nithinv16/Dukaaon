import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';

interface ConnectOption {
  id: string;
  title: string;
  icon: string;
  description: string;
  action: () => void;
}

export default function Connect() {
  const router = useRouter();

  const connectOptions: ConnectOption[] = [
    {
      id: '1',
      title: 'Chat with Customer Care',
      icon: 'message-text',
      description: 'Get instant support through chat',
      action: () => {/* Handle customer care chat */},
    },
    {
      id: '2',
      title: 'Call Customer Care',
      icon: 'phone',
      description: 'Speak directly with our support team',
      action: () => {/* Handle customer care call */},
    },
    {
      id: '3',
      title: 'Chat with Seller',
      icon: 'message-text-outline',
      description: 'Connect with sellers through chat',
      action: () => {/* Handle seller chat */},
    },
    {
      id: '4',
      title: 'Call Seller',
      icon: 'phone-outline',
      description: 'Speak directly with sellers',
      action: () => {/* Handle seller call */},
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.headerTitle}>Connect</Text>
      </View>

      <View style={styles.content}>
        {connectOptions.map((option) => (
          <Card 
            key={option.id} 
            style={styles.card}
            onPress={option.action}
          >
            <Card.Content style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <IconButton
                  icon={option.icon}
                  size={28}
                  iconColor="#2196F3"
                />
              </View>
              <View style={styles.textContainer}>
                <Text variant="titleMedium">{option.title}</Text>
                <Text variant="bodyMedium" style={styles.description}>
                  {option.description}
                </Text>
              </View>
              <IconButton
                icon="chevron-right"
                size={24}
                iconColor="#666"
              />
            </Card.Content>
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 60,
  },
  header: {
    height: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    paddingTop: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  description: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
}); 