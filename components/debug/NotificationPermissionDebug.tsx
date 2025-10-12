import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, Chip } from 'react-native-paper';
import { NotificationPermissionService } from '../../services/permissions/NotificationPermissionService';
import { useSettingsStore } from '../../store/settings';

interface PermissionStatus {
  granted: boolean;
  fcmPermission: boolean;
  androidPermission: boolean;
  error?: string;
}

export function NotificationPermissionDebug() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const { notificationsEnabled, checkNotificationPermissions } = useSettingsStore();

  const checkPermissions = async () => {
    setLoading(true);
    try {
      const status = await NotificationPermissionService.checkNotificationPermissions();
      setPermissionStatus(status);
      
      // Also update the settings store
      await checkNotificationPermissions();
    } catch (error) {
      console.error('Debug: Error checking permissions:', error);
      setPermissionStatus({
        granted: false,
        fcmPermission: false,
        androidPermission: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const requestPermissions = async () => {
    setLoading(true);
    try {
      const result = await NotificationPermissionService.requestPermissionsWithRationale();
      setPermissionStatus(result);
      
      // Also update the settings store
      await checkNotificationPermissions();
    } catch (error) {
      console.error('Debug: Error requesting permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  const getStatusColor = (status: boolean) => status ? '#4CAF50' : '#F44336';
  const getStatusText = (status: boolean) => status ? 'Granted' : 'Denied';

  return (
    <Card style={styles.container}>
      <Card.Title title="Notification Permission Debug" />
      <Card.Content>
        <View style={styles.row}>
          <Text variant="bodyMedium">Settings Store Status:</Text>
          <Chip 
            style={[styles.chip, { backgroundColor: getStatusColor(notificationsEnabled) }]}
            textStyle={{ color: 'white' }}
          >
            {getStatusText(notificationsEnabled)}
          </Chip>
        </View>

        {permissionStatus && (
          <>
            <View style={styles.row}>
              <Text variant="bodyMedium">Overall Permission:</Text>
              <Chip 
                style={[styles.chip, { backgroundColor: getStatusColor(permissionStatus.granted) }]}
                textStyle={{ color: 'white' }}
              >
                {getStatusText(permissionStatus.granted)}
              </Chip>
            </View>

            <View style={styles.row}>
              <Text variant="bodyMedium">Android Permission:</Text>
              <Chip 
                style={[styles.chip, { backgroundColor: getStatusColor(permissionStatus.androidPermission) }]}
                textStyle={{ color: 'white' }}
              >
                {getStatusText(permissionStatus.androidPermission)}
              </Chip>
            </View>

            <View style={styles.row}>
              <Text variant="bodyMedium">Firebase Permission:</Text>
              <Chip 
                style={[styles.chip, { backgroundColor: getStatusColor(permissionStatus.fcmPermission) }]}
                textStyle={{ color: 'white' }}
              >
                {getStatusText(permissionStatus.fcmPermission)}
              </Chip>
            </View>

            {permissionStatus.error && (
              <View style={styles.errorContainer}>
                <Text variant="bodySmall" style={styles.errorText}>
                  Error: {permissionStatus.error}
                </Text>
              </View>
            )}
          </>
        )}

        <View style={styles.buttonContainer}>
          <Button 
            mode="outlined" 
            onPress={checkPermissions}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Check Status
          </Button>
          
          <Button 
            mode="contained" 
            onPress={requestPermissions}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Request Permissions
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  chip: {
    minWidth: 80,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 4,
    marginVertical: 8,
  },
  errorText: {
    color: '#C62828',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
});