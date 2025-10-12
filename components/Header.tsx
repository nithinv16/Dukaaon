import { useRouter } from 'expo-router';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text, Avatar, IconButton } from 'react-native-paper';
import { useAuthStore } from '../store/auth';

export function Header() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);

  const navigateToCart = () => {
    router.push('/(main)/cart');
  };

  return (
    <View style={styles.header}>
      <View style={styles.userInfo}>
        <Avatar.Text 
          size={32} 
          label={user?.email?.[0].toUpperCase() || 'U'} 
        />
        <Text style={styles.userName}>
          {user?.email?.split('@')[0]}
        </Text>
      </View>
      <IconButton 
        icon="cart" 
        size={24} 
        onPress={navigateToCart}
        style={styles.cartButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  userName: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  cartButton: {
    marginLeft: 'auto',
  },
}); 