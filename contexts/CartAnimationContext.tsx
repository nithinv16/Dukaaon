import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CartPosition {
  x: number;
  y: number;
}

interface FlyingProduct {
  id: string;
  imageUrl: string;
  startX: number;
  startY: number;
}

interface CartAnimationContextType {
  cartPosition: CartPosition;
  setCartPosition: (pos: CartPosition) => void;
  triggerCartBounce: () => void;
  cartScale: Animated.Value;
  addFlyingProduct: (product: FlyingProduct) => void;
  flyingProducts: FlyingProduct[];
  removeFlyingProduct: (id: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  toastMessage: string | null;
  toastType: 'success' | 'error';
  hideToast: () => void;
}

const CartAnimationContext = createContext<CartAnimationContextType | null>(null);

export function CartAnimationProvider({ children }: { children: React.ReactNode }) {
  // Default position: top-right corner, offset by 40 to center the 80x80 flying product image
  const [cartPosition, setCartPosition] = useState<CartPosition>({ x: SCREEN_WIDTH - 80, y: 10 });
  const [flyingProducts, setFlyingProducts] = useState<FlyingProduct[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const cartScale = useRef(new Animated.Value(1)).current;
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerCartBounce = useCallback(() => {
    // Bounce animation for cart icon
    Animated.sequence([
      Animated.timing(cartScale, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(cartScale, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cartScale]);

  const addFlyingProduct = useCallback((product: FlyingProduct) => {
    setFlyingProducts(prev => [...prev, product]);
  }, []);

  const removeFlyingProduct = useCallback((id: string) => {
    setFlyingProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    setToastType(type);

    // Auto-hide after 3 seconds
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(null);
  }, []);

  return (
    <CartAnimationContext.Provider
      value={{
        cartPosition,
        setCartPosition,
        triggerCartBounce,
        cartScale,
        addFlyingProduct,
        flyingProducts,
        removeFlyingProduct,
        showToast,
        toastMessage,
        toastType,
        hideToast,
      }}
    >
      {children}
    </CartAnimationContext.Provider>
  );
}

export function useCartAnimation() {
  const context = useContext(CartAnimationContext);
  if (!context) {
    // Return a no-op implementation if used outside provider (graceful fallback)
    return {
      cartPosition: { x: 0, y: 0 },
      setCartPosition: () => { },
      triggerCartBounce: () => { },
      cartScale: new Animated.Value(1),
      addFlyingProduct: () => { },
      flyingProducts: [],
      removeFlyingProduct: () => { },
      showToast: () => { },
      toastMessage: null,
      toastType: 'success' as const,
      hideToast: () => { },
    };
  }
  return context;
}

