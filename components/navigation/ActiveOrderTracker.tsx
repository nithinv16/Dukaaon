import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable, Platform, Modal, ScrollView } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';
import { COLORS } from '../../constants/theme';
import { useInstantTranslation } from '../../hooks/useInstantTranslation';

// Original texts for translation
const ORIGINAL_TEXTS = {
  placed: "Placed",
  confirmed: "Confirmed",
  pickedUp: "Picked up",
  inTransit: "In transit",
  delivered: "Delivered",
  otherActiveOrders: "Other Active Orders",
};

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at?: string;
  payment_status?: string;
  payment_method?: string;
}

const ACTIVE_STATUSES = ['pending', 'placed', 'confirmed', 'accepted', 'processing', 'picked_up', 'in_transit', 'out_for_delivery', 'shipped'];
// Note: 'delivered' and 'completed' are NOT in ACTIVE_STATUSES, so delivered orders won't show
// 'placed' status is added to show orders that have been placed but not yet confirmed by seller


const TrackingStep = ({
  status,
  label,
  currentStatus,
  isLast
}: {
  status: string;
  label: string;
  currentStatus: string;
  isLast: boolean;
}) => {
  const steps = ['placed', 'confirmed', 'picked_up', 'in_transit', 'delivered'];

  const getStepIndex = (s: string) => {
    const st = s?.toLowerCase()?.trim();
    // Step 0: Placed (pending, placed, draft)
    if (['pending', 'placed', 'draft'].includes(st)) return 0;
    // Step 1: Confirmed (confirmed, accepted, preparing, ready)
    if (['confirmed', 'accepted', 'preparing', 'ready'].includes(st)) return 1;
    // Step 2: Picked Up (processing, picked_up)
    if (['processing', 'picked_up'].includes(st)) return 2;
    // Step 3: In Transit (shipped, in_transit, out_for_delivery, intransit)
    if (['shipped', 'in_transit', 'out_for_delivery', 'intransit'].includes(st)) return 3;
    // Step 4: Delivered (delivered, completed)
    if (['delivered', 'completed'].includes(st)) return 4;
    return 0; // Default to placed
  };

  const getIconForStatus = (status: string, isActive: boolean) => {
    if (!isActive) return null;

    switch (status) {
      case 'placed':
        return 'cart-outline';
      case 'confirmed':
        return 'check-circle';
      case 'picked_up':
        return 'package-variant';
      case 'in_transit':
        return 'truck-delivery';
      case 'delivered':
        return 'check-circle';
      default:
        return 'check';
    }
  };

  const currentIdx = getStepIndex(currentStatus);
  const stepIndex = steps.indexOf(status);
  const isActive = stepIndex <= currentIdx;
  const isCurrent = stepIndex === currentIdx;
  const iconName = getIconForStatus(status, isActive);

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepContent}>
        <View style={[
          styles.stepCircle,
          isActive && styles.stepCircleActive,
          isCurrent && styles.stepCircleCurrent
        ]}>
          {isActive && iconName && (
            <IconButton
              icon={iconName}
              size={10}
              iconColor="#FFF"
              style={styles.stepIcon}
            />
          )}
        </View>
        <Text style={[
          styles.stepLabel,
          isActive && styles.stepLabelActive
        ]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {!isLast && (
        <View style={[
          styles.stepLine,
          stepIndex < currentIdx && styles.stepLineActive
        ]} />
      )}
    </View>
  );
};

export function ActiveOrderTracker({ onViewOtherOrdersRef, onVisibilityChangeRef }: { onViewOtherOrdersRef?: React.MutableRefObject<(() => void) | null>, onVisibilityChangeRef?: React.MutableRefObject<((isVisible: boolean) => void) | null> }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [showOtherOrders, setShowOtherOrders] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Translation hook for order tracking labels
  const { t } = useInstantTranslation(ORIGINAL_TEXTS);

  // Reset dismissed state when component mounts - ensures tracker shows when user returns to home
  useEffect(() => {
    setIsDismissed(false);
  }, []); // Only run once on mount

  const fetchActiveOrders = useCallback(async () => {
    if (!user?.id) {
      console.log('[ActiveOrderTracker] No user ID, skipping fetch');
      return;
    }

    console.log('[ActiveOrderTracker] Fetching active orders for user:', user.id);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at, updated_at, payment_status, payment_method')
        .eq('user_id', user.id)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ActiveOrderTracker] Error fetching active orders:', error);
        return;
      }

      console.log('[ActiveOrderTracker] Raw orders from DB:', data?.length || 0, data);

      if (data) {
        // Filter out delivered/completed orders and failed/abandoned payment orders
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const trulyActiveOrders = data.filter(order => {
          const status = order.status?.toLowerCase()?.trim();
          const paymentMethod = order.payment_method?.toLowerCase()?.trim();

          // Filter out delivered/completed orders
          if (['delivered', 'completed'].includes(status)) {
            console.log('[ActiveOrderTracker] Filtering out delivered/completed order:', order.id, status);
            return false;
          }

          // Orders with 'placed' status are confirmed orders - always show them
          // (These are orders that have been successfully placed, regardless of payment status)
          if (status === 'placed') {
            console.log('[ActiveOrderTracker] Keeping placed order:', order.id);
            return true;
          }

          // Always show COD/cash/online orders (including null/undefined which defaults to COD)
          // COD can be stored as 'cod', 'cash', or not set at all
          if (!paymentMethod || paymentMethod === 'cod' || paymentMethod === 'cash' || paymentMethod === 'online') {
            console.log('[ActiveOrderTracker] Keeping COD/cash/online order:', order.id, paymentMethod || 'default');
            return true;
          }

          // For online payment orders, check payment status
          // Show non-pending payment orders (completed payments)
          if (order.payment_status !== 'pending') {
            console.log('[ActiveOrderTracker] Keeping non-pending payment order:', order.id, order.payment_status);
            return true;
          }

          // Show pending online payment orders created within last 5 minutes
          // (User might still be completing payment)
          const orderDate = new Date(order.created_at);
          if (orderDate > fiveMinutesAgo) {
            console.log('[ActiveOrderTracker] Keeping recent pending online order:', order.id);
            return true;
          }

          // Filter out old pending online payment orders (abandoned/failed payments)
          console.log('[ActiveOrderTracker] Filtering out old pending online order:', order.id);
          return false;
        });

        console.log('[ActiveOrderTracker] Filtered active orders:', trulyActiveOrders.length, trulyActiveOrders);
        console.log('[ActiveOrderTracker] Current dismissed state:', isDismissed);

        // Reset dismissed state when we have active orders
        if (trulyActiveOrders.length > 0 && isDismissed) {
          console.log('[ActiveOrderTracker] Resetting dismissed state because we have active orders');
          setIsDismissed(false);
        }

        setActiveOrders(trulyActiveOrders);
        // Reset to first order if current index is out of bounds
        if (trulyActiveOrders.length > 0) {
          setCurrentOrderIndex(prev =>
            prev >= trulyActiveOrders.length ? 0 : prev
          );
        } else {
          setCurrentOrderIndex(0);
        }
      } else {
        console.log('[ActiveOrderTracker] No data returned from query');
      }
    } catch (error) {
      console.error('[ActiveOrderTracker] Error fetching active orders:', error);
    }
  }, [user?.id, isDismissed]);

  useEffect(() => {
    if (!user?.id) return;

    fetchActiveOrders();

    // Subscribe to order changes
    const subscription = supabase
      .channel('active_order_tracker')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchActiveOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchActiveOrders]);


  const handleOrderPress = () => {
    if (activeOrders.length > 0 && activeOrders[currentOrderIndex]) {
      router.push(`/(main)/orders/${activeOrders[currentOrderIndex].id}`);
    }
  };

  const handleOtherOrderPress = (orderId: string) => {
    setShowOtherOrders(false);
    router.push(`/(main)/orders/${orderId}`);
  };

  const handleViewOtherOrders = () => {
    setShowOtherOrders(true);
  };

  const handleDismiss = () => {
    // Session-based dismissal - no persistence, resets on app restart
    setIsDismissed(true);
    // Immediately notify parent about visibility change
    if (onVisibilityChangeRef?.current) {
      onVisibilityChangeRef.current(false);
    }
  };

  // Expose handleViewOtherOrders to parent via ref
  useEffect(() => {
    if (onViewOtherOrdersRef) {
      onViewOtherOrdersRef.current = handleViewOtherOrders;
    }
    return () => {
      if (onViewOtherOrdersRef) {
        onViewOtherOrdersRef.current = null;
      }
    };
  }, [onViewOtherOrdersRef]);

  // Format time helper
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  // Notify parent about visibility changes
  useEffect(() => {
    if (onVisibilityChangeRef) {
      const isVisible = activeOrders.length > 0 && !isDismissed;
      onVisibilityChangeRef.current?.(isVisible);
    }
  }, [activeOrders.length, isDismissed, onVisibilityChangeRef]);

  // Debug: Log render conditions
  console.log('[ActiveOrderTracker] Render check - activeOrders.length:', activeOrders.length, 'isDismissed:', isDismissed);
  console.log('[ActiveOrderTracker] Active orders:', activeOrders);

  // Don't render if no active orders or if dismissed
  if (activeOrders.length === 0 || isDismissed) {
    console.log('[ActiveOrderTracker] Returning null - no orders or dismissed');
    return null;
  }

  console.log('[ActiveOrderTracker] Rendering tracker');

  const currentOrder = activeOrders[currentOrderIndex];
  const otherOrders = activeOrders.filter((_, index) => index !== currentOrderIndex);

  // Get short order ID
  const shortOrderId = currentOrder.order_number
    ? currentOrder.order_number.slice(-6).toUpperCase()
    : currentOrder.id.slice(-6).toUpperCase();

  // Get order time
  const orderTime = formatTime(currentOrder.updated_at || currentOrder.created_at);

  // Get other orders (excluding current) for background layers
  const otherOrdersForLayers = activeOrders.filter((_, index) => index !== currentOrderIndex);
  const maxLayers = Math.min(otherOrdersForLayers.length, 3); // Show max 3 layers

  return (
    <>
      <Pressable onPress={handleOrderPress} style={styles.container}>
        {/* Background layers for depth effect - stacked behind main card */}
        {/* Only show layers when there are other active orders */}
        {otherOrdersForLayers.length > 0 && otherOrdersForLayers.slice(0, maxLayers).map((order, layerIndex) => {
          const layerOffset = (layerIndex + 1) * 2; // 2px, 4px, 6px offsets
          const layerOpacity = 0.5 - (layerIndex * 0.1); // Decreasing opacity: 0.5, 0.4, 0.3
          const borderOpacity = 0.08 - (layerIndex * 0.02); // Decreasing border opacity

          // Get short order ID for this layer
          const layerOrderId = order.order_number
            ? order.order_number.slice(-6).toUpperCase()
            : order.id.slice(-6).toUpperCase();

          // Get order time for this layer
          const layerOrderTime = formatTime(order.updated_at || order.created_at);

          return (
            <View
              key={order.id}
              style={[
                styles.backgroundLayerBase,
                {
                  top: -layerOffset,
                  left: layerOffset,
                  right: -layerOffset,
                  bottom: layerOffset,
                  zIndex: -(layerIndex + 1),
                }
              ]}
            >
              <View style={styles.backgroundLayerTopBoxes}>
                <View style={[
                  styles.orderTimeBox,
                  {
                    backgroundColor: Platform.OS === 'ios'
                      ? `rgba(255, 255, 255, ${layerOpacity * 0.8})`
                      : `rgba(255, 255, 255, ${layerOpacity})`,
                    borderColor: `rgba(0, 0, 0, ${borderOpacity})`,
                    zIndex: 0,
                  }
                ]}>
                  <Text style={[styles.orderTimeLeft, { opacity: 0.6 }]}>
                    {layerOrderTime}
                  </Text>
                </View>
                <View style={[
                  styles.orderIdBoxWithClose,
                  {
                    backgroundColor: Platform.OS === 'ios'
                      ? `rgba(255, 255, 255, ${layerOpacity * 0.8})`
                      : `rgba(255, 255, 255, ${layerOpacity})`,
                    borderColor: `rgba(0, 0, 0, ${borderOpacity})`,
                    zIndex: 0,
                  }
                ]}>
                  <Text style={[styles.orderIdRight, { opacity: 0.6 }]}>
                    #{layerOrderId}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.trackerContainer,
                {
                  backgroundColor: Platform.OS === 'ios'
                    ? `rgba(255, 255, 255, ${layerOpacity * 0.8})`
                    : `rgba(255, 255, 255, ${layerOpacity})`,
                  borderColor: `rgba(0, 0, 0, ${borderOpacity})`,
                  zIndex: 0,
                }
              ]}>
                {/* Empty tracker content to match height */}
              </View>
            </View>
          );
        })}

        {/* Time and Order ID boxes at ends, connected to tracker */}
        <View style={styles.orderInfoContainer}>
          {/* Time box on left */}
          <View style={styles.orderTimeBox}>
            <Text style={styles.orderTimeLeft}>{orderTime}</Text>
          </View>

          {/* Order ID box on right with close button */}
          <View style={styles.orderIdBoxWithClose}>
            <Text style={styles.orderIdRight}>#{shortOrderId}</Text>
            <Pressable onPress={handleDismiss} style={styles.closeButton}>
              <IconButton icon="close" size={14} iconColor="#757575" style={styles.closeIcon} />
            </Pressable>
          </View>
        </View>

        <View style={styles.trackerContainer}>
          {/* Progress steps container */}
          <View style={styles.progressWrapper}>
            {/* Left side progress steps */}
            <View style={styles.progressLeft}>
              <TrackingStep
                status="placed"
                label={t.placed}
                currentStatus={currentOrder.status}
                isLast={false}
              />
              <TrackingStep
                status="confirmed"
                label={t.confirmed}
                currentStatus={currentOrder.status}
                isLast={false}
              />
              <TrackingStep
                status="picked_up"
                label={t.pickedUp}
                currentStatus={currentOrder.status}
                isLast={true}
              />
            </View>

            {/* Center space for phone button bump with connecting line */}
            <View style={styles.phoneButtonSpace}>
              {/* Line passing behind the bump */}
              {(() => {
                const getStepIndex = (s: string) => {
                  const st = s?.toLowerCase()?.trim();
                  if (['pending', 'draft'].includes(st)) return 0;
                  if (['confirmed', 'accepted', 'preparing', 'ready'].includes(st)) return 1;
                  if (['processing', 'picked_up'].includes(st)) return 2;
                  if (['shipped', 'in_transit', 'out_for_delivery', 'intransit'].includes(st)) return 3;
                  if (['delivered', 'completed'].includes(st)) return 4;
                  return 0;
                };
                const currentIdx = getStepIndex(currentOrder.status);
                // Line is active when we've passed "picked_up" (index 2) and are moving to "in_transit" or beyond
                const isLineActive = currentIdx > 2;
                return (
                  <View style={[
                    styles.connectingLine,
                    isLineActive && styles.connectingLineActive
                  ]} />
                );
              })()}
            </View>

            {/* Right side progress steps */}
            <View style={styles.progressRight}>
              <TrackingStep
                status="in_transit"
                label={t.inTransit}
                currentStatus={currentOrder.status}
                isLast={false}
              />
              <TrackingStep
                status="delivered"
                label={t.delivered}
                currentStatus={currentOrder.status}
                isLast={true}
              />
            </View>
          </View>
        </View>
      </Pressable>

      {/* Other Orders Modal */}
      <Modal
        visible={showOtherOrders}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOtherOrders(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowOtherOrders(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.otherActiveOrders}</Text>
              <IconButton
                icon="close"
                size={20}
                iconColor="#666"
                onPress={() => setShowOtherOrders(false)}
                style={styles.modalCloseButton}
              />
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              {otherOrders.map((order, index) => {
                // Get short order ID for this order
                const orderShortId = order.order_number
                  ? order.order_number.slice(-6).toUpperCase()
                  : order.id.slice(-6).toUpperCase();

                // Get order time for this order
                const orderTimeStr = formatTime(order.updated_at || order.created_at);

                return (
                  <Pressable
                    key={order.id}
                    onPress={() => handleOtherOrderPress(order.id)}
                    style={styles.otherOrderItem}
                  >
                    {/* Time on left, Order ID on right - outside tracker */}
                    <View style={styles.otherOrderInfoRow}>
                      <Text style={styles.otherOrderTimeLeft}>{orderTimeStr}</Text>
                      <Text style={styles.otherOrderIdRight}>#{orderShortId}</Text>
                    </View>

                    <View style={styles.otherOrderTrackerContainer}>
                      {/* Progress steps for other order */}
                      <View style={styles.progressWrapper}>
                        {/* Left side progress steps */}
                        <View style={styles.progressLeft}>
                          <TrackingStep
                            status="placed"
                            label={t.placed}
                            currentStatus={order.status}
                            isLast={false}
                          />
                          <TrackingStep
                            status="confirmed"
                            label={t.confirmed}
                            currentStatus={order.status}
                            isLast={false}
                          />
                          <TrackingStep
                            status="picked_up"
                            label={t.pickedUp}
                            currentStatus={order.status}
                            isLast={true}
                          />
                        </View>

                        {/* Center space for phone button bump with connecting line */}
                        <View style={styles.phoneButtonSpace}>
                          {(() => {
                            const getStepIndex = (s: string) => {
                              const st = s?.toLowerCase()?.trim();
                              if (['pending', 'draft'].includes(st)) return 0;
                              if (['confirmed', 'accepted', 'preparing', 'ready'].includes(st)) return 1;
                              if (['processing', 'picked_up'].includes(st)) return 2;
                              if (['shipped', 'in_transit', 'out_for_delivery', 'intransit'].includes(st)) return 3;
                              if (['delivered', 'completed'].includes(st)) return 4;
                              return 0;
                            };
                            const currentIdx = getStepIndex(order.status);
                            const isLineActive = currentIdx > 2;
                            return (
                              <View style={[
                                styles.connectingLine,
                                isLineActive && styles.connectingLineActive
                              ]} />
                            );
                          })()}
                        </View>

                        {/* Right side progress steps */}
                        <View style={styles.progressRight}>
                          <TrackingStep
                            status="in_transit"
                            label={t.inTransit}
                            currentStatus={order.status}
                            isLast={false}
                          />
                          <TrackingStep
                            status="delivered"
                            label={t.delivered}
                            currentStatus={order.status}
                            isLast={true}
                          />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 0,
    position: 'relative',
  },
  // Background layer base styles (dynamic based on number of orders)
  backgroundLayerBase: {
    position: 'absolute',
    width: '100%',
  },
  backgroundLayerTopBoxes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 0,
  },
  orderInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 0,
    zIndex: 2,
    position: 'relative',
  },
  orderTimeBox: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 3,
    position: 'relative',
  },
  orderIdBox: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  orderIdBoxWithClose: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
    position: 'relative',
  },
  closeButton: {
    marginLeft: 4,
    marginTop: -2, // Move button up slightly
  },
  closeIcon: {
    margin: 0,
    width: 14,
    height: 14,
  },
  trackerContainer: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.95)', // Match bottom nav
    borderTopLeftRadius: 0, // No top radius to connect with boxes
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 35, // Bottom radius only
    borderBottomRightRadius: 35,
    padding: 8,
    paddingRight: 0, // Remove right padding to allow "Delivered" to extend further
    paddingTop: 10, // Increased top padding for spacing
    paddingBottom: 12, // Reduced bottom padding to prevent nav overlap
    elevation: 0, // No shadow effect
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    overflow: 'hidden', // Keep hidden to contain content within rounded borders
    // Border on left, right, and bottom sides only (no top border to connect with boxes)
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 1,
    position: 'relative',
  },
  orderTimeLeft: {
    fontSize: 10,
    color: '#757575',
    fontWeight: '600',
  },
  orderIdRight: {
    fontSize: 10,
    color: COLORS.orange,
    fontWeight: '700',
  },
  progressWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 0, // No padding to allow line to extend seamlessly
    marginRight: -2, // Negative margin to bring line closer to "Picked up"
  },
  phoneButtonSpace: {
    width: 70, // Space for phone button (64px button + 6px margin)
    flexDirection: 'row',
    alignItems: 'center', // Match stepContainer alignItems to align with stepLines
    position: 'relative',
    minHeight: 20, // Minimum height to accommodate the line
    marginLeft: 0, // No left margin to bring line closer
    marginRight: 2, // Keep right margin for spacing with "In transit"
  },
  connectingLine: {
    flex: 1, // Match stepLine flex: 1 to extend fully across the space
    height: 2,
    backgroundColor: '#E0E0E0',
    // Match stepLine exactly: use the same marginTop: -3 to align with circle centers
    marginTop: -3, // Match stepLine marginTop: -3 positioning
    zIndex: 1,
  },
  connectingLineActive: {
    backgroundColor: COLORS.orange,
  },
  progressRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    paddingLeft: 2,
    marginRight: -15, // Negative margin to push "Delivered" further to the right edge
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  stepContent: {
    alignItems: 'center',
    zIndex: 2,
    flex: 0,
  },
  stepCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  stepCircleActive: {
    backgroundColor: COLORS.orange,
  },
  stepCircleCurrent: {
    backgroundColor: COLORS.orange,
    elevation: 3,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  stepIcon: {
    margin: 0,
    width: 16,
    height: 16,
  },
  stepLabel: {
    fontSize: 9,
    color: '#9E9E9E',
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 50,
    marginTop: 2,
  },
  stepLabelActive: {
    color: COLORS.orange,
    fontWeight: '700',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 2,
    marginTop: -3,
    zIndex: 1,
  },
  stepLineActive: {
    backgroundColor: COLORS.orange,
  },
  // View Other Orders Button
  viewOtherOrdersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  viewOtherOrdersText: {
    fontSize: 9,
    color: COLORS.orange,
    fontWeight: '600',
    marginRight: 2,
  },
  viewOtherOrdersIcon: {
    margin: 0,
    width: 16,
    height: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  modalCloseButton: {
    margin: 0,
  },
  modalScrollView: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  otherOrderItem: {
    marginBottom: 12,
  },
  otherOrderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  otherOrderTimeLeft: {
    fontSize: 10,
    color: '#757575',
    fontWeight: '600',
  },
  otherOrderIdRight: {
    fontSize: 10,
    color: COLORS.orange,
    fontWeight: '700',
  },
  otherOrderTrackerContainer: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
    borderRadius: 35,
    padding: 6,
    paddingRight: 0,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
});

