import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotificationService } from '../../services/notifications/NotificationService';
import { useAuthStore } from '../../store/auth';

interface WhatsAppPreferencesProps {
  onClose?: () => void;
}

interface PreferencesState {
  whatsapp_notifications: boolean;
  whatsapp_number: string;
  whatsapp_opt_in: boolean;
}

export const WhatsAppPreferences: React.FC<WhatsAppPreferencesProps> = ({ onClose }) => {
  const { user } = useAuthStore();
  const [preferences, setPreferences] = useState<PreferencesState>({
    whatsapp_notifications: false,
    whatsapp_number: '',
    whatsapp_opt_in: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempNumber, setTempNumber] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      if (user?.phone_number) {
        const prefs = await NotificationService.getWhatsAppPreferences(user.phone_number);
        if (prefs) {
          setPreferences({
            whatsapp_notifications: prefs.whatsapp_notifications || false,
            whatsapp_number: prefs.whatsapp_number || user.phone_number,
            whatsapp_opt_in: prefs.whatsapp_opt_in || false,
          });
          setTempNumber(prefs.whatsapp_number || user.phone_number);
        } else {
          // Set defaults if no preferences found
          setPreferences({
            whatsapp_notifications: false,
            whatsapp_number: user.phone_number,
            whatsapp_opt_in: false,
          });
          setTempNumber(user.phone_number);
        }
      }
    } catch (error) {
      console.error('Error loading WhatsApp preferences:', error);
      Alert.alert('Error', 'Failed to load WhatsApp preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleOptInToggle = async (value: boolean) => {
    try {
      setSaving(true);
      
      if (value) {
        // Show confirmation dialog for opt-in
        Alert.alert(
          'WhatsApp Notifications',
          'You will receive order updates, stock alerts, and other notifications via WhatsApp. You can opt out anytime.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setSaving(false),
            },
            {
              text: 'Enable',
              onPress: async () => {
                await updateOptInStatus(value);
              },
            },
          ]
        );
      } else {
        // Show confirmation dialog for opt-out
        Alert.alert(
          'Disable WhatsApp Notifications',
          'You will no longer receive notifications via WhatsApp. You can re-enable this anytime.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setSaving(false),
            },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: async () => {
                await updateOptInStatus(value);
              },
            },
          ]
        );
      }
    } catch (error) {
      setSaving(false);
      console.error('Error toggling opt-in:', error);
    }
  };

  const updateOptInStatus = async (value: boolean) => {
    try {
      if (user?.phone_number) {
        const success = await NotificationService.updateWhatsAppOptIn(user.phone_number, value);
        if (success) {
          setPreferences(prev => ({ ...prev, whatsapp_opt_in: value }));
          Alert.alert(
            'Success',
            value 
              ? 'WhatsApp notifications enabled successfully!' 
              : 'WhatsApp notifications disabled successfully!'
          );
        } else {
          Alert.alert('Error', 'Failed to update WhatsApp preferences');
        }
      }
    } catch (error) {
      console.error('Error updating opt-in status:', error);
      Alert.alert('Error', 'Failed to update WhatsApp preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    try {
      setSaving(true);
      // This would update the general notification preference
      // Implementation depends on your user preferences structure
      setPreferences(prev => ({ ...prev, whatsapp_notifications: value }));
      setSaving(false);
    } catch (error) {
      setSaving(false);
      console.error('Error updating notifications preference:', error);
    }
  };

  const handleNumberEdit = () => {
    setIsEditing(true);
  };

  const handleNumberSave = async () => {
    try {
      setSaving(true);
      
      // Validate phone number format
      const cleanNumber = tempNumber.replace(/\D/g, '');
      if (cleanNumber.length < 10) {
        Alert.alert('Invalid Number', 'Please enter a valid phone number');
        setSaving(false);
        return;
      }
      
      // Format number with country code if not present
      let formattedNumber = tempNumber;
      if (!formattedNumber.startsWith('+')) {
        formattedNumber = '+91' + cleanNumber; // Assuming Indian numbers
      }
      
      setPreferences(prev => ({ ...prev, whatsapp_number: formattedNumber }));
      setTempNumber(formattedNumber);
      setIsEditing(false);
      
      Alert.alert('Success', 'WhatsApp number updated successfully!');
    } catch (error) {
      console.error('Error updating WhatsApp number:', error);
      Alert.alert('Error', 'Failed to update WhatsApp number');
    } finally {
      setSaving(false);
    }
  };

  const handleNumberCancel = () => {
    setTempNumber(preferences.whatsapp_number);
    setIsEditing(false);
  };

  const sendTestMessage = async () => {
    try {
      setSaving(true);
      
      if (!preferences.whatsapp_opt_in) {
        Alert.alert('Not Enabled', 'Please enable WhatsApp notifications first');
        setSaving(false);
        return;
      }
      
      // This would send a test message
      Alert.alert(
        'Test Message',
        'A test message will be sent to your WhatsApp number. Continue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setSaving(false),
          },
          {
            text: 'Send',
            onPress: async () => {
              try {
                // Implementation would call WhatsApp service
                // await WhatsAppService.sendTextMessage(preferences.whatsapp_number, 'Test message from DukaaOn!');
                Alert.alert('Success', 'Test message sent! Check your WhatsApp.');
              } catch (error) {
                Alert.alert('Error', 'Failed to send test message');
              } finally {
                setSaving(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      setSaving(false);
      console.error('Error sending test message:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading WhatsApp preferences...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>WhatsApp Preferences</Text>
      </View>

      <View style={styles.content}>
        {/* WhatsApp Opt-in Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            <Text style={styles.sectionTitle}>WhatsApp Notifications</Text>
          </View>
          
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Enable WhatsApp Notifications</Text>
              <Text style={styles.optionDescription}>
                Receive order updates, stock alerts, and delivery notifications via WhatsApp
              </Text>
            </View>
            <Switch
              value={preferences.whatsapp_opt_in}
              onValueChange={handleOptInToggle}
              disabled={saving}
              trackColor={{ false: '#E5E5E5', true: '#25D366' }}
              thumbColor={preferences.whatsapp_opt_in ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>

          {preferences.whatsapp_opt_in && (
            <View style={styles.enabledInfo}>
              <Ionicons name="checkmark-circle" size={16} color="#25D366" />
              <Text style={styles.enabledText}>WhatsApp notifications are enabled</Text>
            </View>
          )}
        </View>

        {/* WhatsApp Number Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="phone-portrait" size={24} color="#007AFF" />
            <Text style={styles.sectionTitle}>WhatsApp Number</Text>
          </View>
          
          <View style={styles.numberContainer}>
            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.numberInput}
                  value={tempNumber}
                  onChangeText={setTempNumber}
                  placeholder="Enter WhatsApp number"
                  keyboardType="phone-pad"
                  autoFocus
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity
                    onPress={handleNumberCancel}
                    style={[styles.editButton, styles.cancelButton]}
                    disabled={saving}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleNumberSave}
                    style={[styles.editButton, styles.saveButton]}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.numberDisplay}>
                <Text style={styles.numberText}>{preferences.whatsapp_number}</Text>
                <TouchableOpacity onPress={handleNumberEdit} style={styles.editIcon}>
                  <Ionicons name="pencil" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          <Text style={styles.numberDescription}>
            This number will be used for WhatsApp notifications. Make sure it's a valid WhatsApp number.
          </Text>
        </View>

        {/* Notification Types Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={24} color="#FF9500" />
            <Text style={styles.sectionTitle}>Notification Types</Text>
          </View>
          
          <View style={styles.notificationTypes}>
            <View style={styles.typeItem}>
              <Ionicons name="bag" size={20} color="#007AFF" />
              <Text style={styles.typeText}>Order Updates</Text>
              <Ionicons name="checkmark" size={20} color="#25D366" />
            </View>
            <View style={styles.typeItem}>
              <Ionicons name="cube" size={20} color="#007AFF" />
              <Text style={styles.typeText}>Stock Alerts</Text>
              <Ionicons name="checkmark" size={20} color="#25D366" />
            </View>
            <View style={styles.typeItem}>
              <Ionicons name="car" size={20} color="#007AFF" />
              <Text style={styles.typeText}>Delivery Updates</Text>
              <Ionicons name="checkmark" size={20} color="#25D366" />
            </View>
            <View style={styles.typeItem}>
              <Ionicons name="card" size={20} color="#007AFF" />
              <Text style={styles.typeText}>Payment Reminders</Text>
              <Ionicons name="checkmark" size={20} color="#25D366" />
            </View>
          </View>
        </View>

        {/* Test Message Section */}
        {preferences.whatsapp_opt_in && (
          <View style={styles.section}>
            <TouchableOpacity
              onPress={sendTestMessage}
              style={styles.testButton}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#FFFFFF" />
                  <Text style={styles.testButtonText}>Send Test Message</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Information Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={20} color="#007AFF" />
            <Text style={styles.infoTitle}>Important Information</Text>
          </View>
          <Text style={styles.infoText}>
            • You can opt out of WhatsApp notifications anytime{"\n"}
            • Your phone number is kept secure and private{"\n"}
            • Standard WhatsApp charges may apply{"\n"}
            • You'll also receive notifications in the app
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  closeButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionInfo: {
    flex: 1,
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  enabledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#F0F9F0',
    borderRadius: 8,
  },
  enabledText: {
    fontSize: 14,
    color: '#25D366',
    marginLeft: 8,
    fontWeight: '500',
  },
  numberContainer: {
    marginBottom: 8,
  },
  numberDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  numberText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  editIcon: {
    padding: 4,
  },
  editContainer: {
    gap: 12,
  },
  numberInput: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    fontSize: 16,
    color: '#333',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  numberDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  notificationTypes: {
    gap: 12,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  typeText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  testButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default WhatsAppPreferences;