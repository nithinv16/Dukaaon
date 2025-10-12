# Firebase Cloud Messaging (FCM) Integration Guide

## Overview
This guide covers the complete Firebase Cloud Messaging integration for push notifications in the Dukaaon app, including order updates, delivery notifications, OTP messages, and general push notifications.

## Features Implemented

### 1. Core FCM Service (`services/firebase/messaging.ts`)
- **Permission Management**: Requests and handles notification permissions
- **Token Management**: Retrieves, refreshes, and updates FCM tokens
- **Message Handling**: Processes foreground and background notifications
- **Database Integration**: Saves notifications to Supabase and local storage

### 2. Notification Service (`services/notifications/NotificationService.ts`)
- **Order Notifications**: Handles order status updates (placed, confirmed, shipped, delivered)
- **Delivery Notifications**: Manages delivery updates and OTP notifications
- **Topic Subscriptions**: Subscribes users to relevant notification topics
- **User Settings**: Manages notification preferences

### 3. UI Components
- **NotificationBanner** (`components/notifications/NotificationBanner.tsx`): In-app notification display
- **NotificationProvider** (`providers/NotificationProvider.tsx`): Global notification context
- **Test Interface** (`app/(main)/test-notifications.tsx`): Testing and debugging interface

## Configuration

### App Configuration (`app.config.js`)
```javascript
plugins: [
  // ... other plugins
  [
    "@react-native-firebase/app",
    {
      "android_package_name": "com.sixn8.dukaaon"
    }
  ],
  [
    "@react-native-firebase/messaging",
    {
      "android_package_name": "com.sixn8.dukaaon"
    }
  ]
]
```

### Firebase Configuration
- **google-services.json**: Already configured for Android
- **Firebase Console**: Project ID `dukaaon` with messaging enabled

## Usage

### 1. Initialization
The FCM service is automatically initialized when the app starts via `app/_layout.tsx`:

```typescript
import { NotificationService } from '../services/notifications/NotificationService';

useEffect(() => {
  NotificationService.initialize();
}, []);
```

### 2. Sending Notifications

#### Order Notifications
```typescript
await NotificationService.sendOrderNotification({
  orderId: 'order_123',
  userId: 'user_456',
  status: 'shipped',
  title: 'Order Shipped',
  message: 'Your order #123 has been shipped'
});
```

#### Delivery Notifications
```typescript
await NotificationService.sendDeliveryNotification({
  orderId: 'order_123',
  userId: 'user_456',
  status: 'out_for_delivery',
  title: 'Out for Delivery',
  message: 'Your order is out for delivery',
  estimatedTime: '2 hours'
});
```

#### OTP Notifications
```typescript
await NotificationService.sendOTPNotification({
  userId: 'user_456',
  otp: '123456',
  purpose: 'delivery_verification',
  title: 'Delivery OTP',
  message: 'Your delivery OTP is 123456'
});
```

### 3. In-App Notifications
Use the notification provider to show in-app notifications:

```typescript
import { useNotification } from '../providers/NotificationProvider';

const { showNotification } = useNotification();

showNotification({
  type: 'success',
  title: 'Success',
  message: 'Operation completed successfully'
});
```

## Testing

### Test Interface
Access the test interface at `/(main)/test-notifications` to:
- Send test notifications
- View FCM token
- Test different notification types
- Debug notification delivery

### Manual Testing Steps
1. Open the test notifications screen
2. Grant notification permissions when prompted
3. Copy the FCM token for external testing
4. Send test notifications using the interface
5. Verify notifications appear in foreground and background

## Database Schema

### Notifications Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'order', 'delivery', 'otp', 'general'
  data JSONB, -- Additional notification data
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### User Notification Settings
```sql
CREATE TABLE user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  order_updates BOOLEAN DEFAULT TRUE,
  delivery_updates BOOLEAN DEFAULT TRUE,
  otp_notifications BOOLEAN DEFAULT TRUE,
  general_notifications BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Troubleshooting

### Common Issues

1. **Notifications not received**
   - Check notification permissions
   - Verify FCM token is valid
   - Ensure Firebase project configuration is correct

2. **Token refresh issues**
   - Check network connectivity
   - Verify Supabase connection
   - Review token update logic

3. **Background notifications not working**
   - Ensure app is properly configured for background processing
   - Check device battery optimization settings
   - Verify Firebase messaging service is running

### Debug Commands
```bash
# Check FCM token
npx expo start --clear

# View logs
npx expo logs --platform android

# Test notification delivery
# Use Firebase Console > Cloud Messaging > Send test message
```

## Security Considerations

1. **Token Security**: FCM tokens are stored securely in Supabase
2. **User Privacy**: Notification preferences are user-controlled
3. **Data Validation**: All notification data is validated before processing
4. **Permission Handling**: Proper permission requests and handling

## Future Enhancements

1. **Rich Notifications**: Add images, actions, and custom layouts
2. **Notification Scheduling**: Schedule notifications for specific times
3. **Analytics**: Track notification delivery and engagement
4. **A/B Testing**: Test different notification strategies
5. **Localization**: Multi-language notification support

## Dependencies

```json
{
  "@react-native-firebase/app": "^18.9.0",
  "@react-native-firebase/messaging": "^18.9.0",
  "@react-native-async-storage/async-storage": "^1.x.x",
  "react-native-paper": "^5.x.x"
}
```

## Support

For issues or questions regarding FCM integration:
1. Check the test interface for debugging
2. Review Firebase Console logs
3. Verify device and app permissions
4. Test with different notification types

---

**Note**: This integration supports both foreground and background notifications, with proper handling for different app states and user permissions.