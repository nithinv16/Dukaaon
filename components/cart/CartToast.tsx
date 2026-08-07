import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartAnimation } from '../../contexts/CartAnimationContext';

const TOAST_DURATION = 3000; // 3 seconds

export default function CartToast() {
  const { toastMessage, toastType, hideToast } = useCartAnimation();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (toastMessage) {
      // Reset progress
      progressAnim.setValue(1);
      
      // Slide in and fade in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Animate progress bar countdown
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: TOAST_DURATION,
        useNativeDriver: false, // width animation needs native driver off
      }).start();
    } else {
      // Slide out and fade out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [toastMessage]);

  if (!toastMessage) return null;

  const isSuccess = toastType === 'success';
  
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.toast,
          isSuccess ? styles.successToast : styles.errorToast,
        ]}
        onPress={hideToast}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
            size={24}
            color="#fff"
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.message}>{toastMessage}</Text>
          <Text style={styles.hint}>Tap to dismiss</Text>
        </View>
        <View style={styles.progressBar}>
          <Animated.View 
            style={[
              styles.progress, 
              isSuccess ? styles.successProgress : styles.errorProgress,
              { width: progressWidth }
            ]} 
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 10000,
    elevation: 10000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  successToast: {
    backgroundColor: '#1B5E20',
  },
  errorToast: {
    backgroundColor: '#B71C1C',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progress: {
    height: '100%',
    width: '100%',
  },
  successProgress: {
    backgroundColor: '#4CAF50',
  },
  errorProgress: {
    backgroundColor: '#EF5350',
  },
});

