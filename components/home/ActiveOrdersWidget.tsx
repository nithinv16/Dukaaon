import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Pressable, PanResponder } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';
import { LinearGradient } from 'expo-linear-gradient';

const CARD_WIDTH = 150;

interface Order {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    created_at: string;
    payment_status?: string;
    payment_method?: string;
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'accepted', 'processing', 'picked_up', 'in_transit', 'out_for_delivery', 'shipped'];

const VerticalTrackingStep = React.memo(({ status, label, currentStatus, isLast, icon }: { status: string, label: string, currentStatus: string, isLast: boolean, icon: string }) => {
    const steps = ['placed', 'confirmed', 'picked_up', 'in_transit', 'delivered'];
    const getStepIndex = (s: string) => {
        const st = s?.toLowerCase()?.trim();
        if (['pending', 'draft'].includes(st)) return 0;
        if (['confirmed', 'accepted', 'preparing', 'ready'].includes(st)) return 1;
        if (['processing', 'picked_up'].includes(st)) return 2;
        if (['shipped', 'in_transit', 'out_for_delivery', 'intransit'].includes(st)) return 3;
        if (['delivered', 'completed'].includes(st)) return 4;
        return 0;
    };

    const currentIdx = getStepIndex(currentStatus);
    const stepIndex = steps.indexOf(status);
    const isActive = stepIndex <= currentIdx;
    const isCurrent = stepIndex === currentIdx;

    return (
        <View style={{ flexDirection: 'row', minHeight: 24 }}>
            <View style={{ alignItems: 'center', width: 20, marginRight: 6 }}>
                <View style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: isActive ? '#FF7D00' : '#F0F0F0',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 2,
                    borderWidth: isCurrent ? 1 : 0,
                    borderColor: '#FF7D00',
                }}>
                    {isActive ? (
                        <IconButton icon={icon} size={10} iconColor="#FFF" style={{ margin: 0 }} />
                    ) : (
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#DDD' }} />
                    )}
                </View>
                {!isLast && (
                    <View style={{
                        position: 'absolute',
                        top: 16,
                        bottom: -2,
                        width: 2,
                        backgroundColor: stepIndex < currentIdx ? '#FF7D00' : '#F0F0F0',
                        zIndex: 1,
                    }} />
                )}
            </View>
            <View style={{ flex: 1, justifyContent: 'center', marginBottom: isLast ? 0 : 6 }}>
                <Text style={{
                    fontSize: 10,
                    fontWeight: isActive ? '700' : '400',
                    color: isActive ? '#333' : '#AAA',
                }} numberOfLines={1}>
                    {label}
                </Text>
            </View>
        </View>
    );
});

const CardContent = React.memo(({ order, formatTime }: { order: Order, formatTime: (s?: string) => string }) => (
    <>
        <View style={styles.cardHeader}>
            <View>
                <Text style={styles.orderNumber}>#{order.order_number?.slice(-6)}</Text>
                <Text style={styles.orderTime}>{formatTime(order.created_at)}</Text>
            </View>
            <Text style={styles.orderAmount}>₹{order.total_amount?.toFixed(0)}</Text>
        </View>
        <View style={styles.trackingContainer}>
            <VerticalTrackingStep status="placed" label="Placed" currentStatus={order.status} isLast={false} icon="clipboard-text-outline" />
            <VerticalTrackingStep status="confirmed" label="Confirm" currentStatus={order.status} isLast={false} icon="check" />
            <VerticalTrackingStep status="picked_up" label="Picked" currentStatus={order.status} isLast={false} icon="package-variant" />
            <VerticalTrackingStep status="in_transit" label="Transit" currentStatus={order.status} isLast={false} icon="truck-delivery" />
            <VerticalTrackingStep status="delivered" label="Done" currentStatus={order.status} isLast={true} icon="home" />
        </View>
    </>
));

export const ActiveOrdersWidget = () => {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [activeOrders, setActiveOrders] = useState<Order[]>([]);
    const [expanded, setExpanded] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipping, setIsFlipping] = useState(false);

    const animation = useRef(new Animated.Value(0)).current;
    const pan = useRef(new Animated.Value(0)).current;
    const flipAnim = useRef(new Animated.Value(0)).current;
    const swipeThreshold = 50;

    // Refs to access latest state in PanResponder closures
    const activeOrdersRef = useRef(activeOrders);
    activeOrdersRef.current = activeOrders;
    const currentIndexRef = useRef(currentIndex);
    currentIndexRef.current = currentIndex;

    useEffect(() => {
        fetchActiveOrders();
        const subscription = supabase
            .channel('active_orders_widget')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user?.id}` },
                () => { fetchActiveOrders(); }
            )
            .subscribe();
        return () => { subscription.unsubscribe(); };
    }, [user?.id]);

    const fetchActiveOrders = async () => {
        if (!user?.id) return;
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('id, order_number, status, total_amount, created_at, payment_status, payment_method')
                .eq('user_id', user.id)
                .in('status', ACTIVE_STATUSES)
                .order('created_at', { ascending: false });

            if (!error && data) {
                // Filter out failed/abandoned online payment orders
                // (pending payment_status + online payment_method + older than 5 minutes)
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const filteredOrders = data.filter(order => {
                    const status = order.status?.toLowerCase()?.trim();
                    const paymentMethod = order.payment_method?.toLowerCase()?.trim();

                    // Orders with 'placed' status are confirmed orders - always show them
                    if (status === 'placed') {
                        return true;
                    }

                    // Always show COD/cash/online orders (including null/undefined which defaults to COD)
                    if (!paymentMethod || paymentMethod === 'cod' || paymentMethod === 'cash' || paymentMethod === 'online') {
                        return true;
                    }

                    // Show non-pending payment orders (completed payments)
                    if (order.payment_status !== 'pending') {
                        return true;
                    }

                    // Show pending online payment orders created within last 5 minutes
                    const orderDate = new Date(order.created_at);
                    if (orderDate > fiveMinutesAgo) {
                        return true;
                    }

                    // Filter out old pending online payment orders (abandoned/failed payments)
                    return false;
                });

                setActiveOrders(filteredOrders);
                setCurrentIndex(0);
            }
        } catch (error) {
            console.error('Error fetching active orders:', error);
        }
    };

    const toggleExpand = () => {
        if (!expanded) {
            setExpanded(true);
            Animated.spring(animation, { toValue: 1, useNativeDriver: true }).start();
        } else {
            Animated.spring(animation, { toValue: 0, useNativeDriver: true }).start(() => setExpanded(false));
        }
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
            onPanResponderGrant: () => {
                pan.setOffset((pan as any)._value);
                pan.setValue(0);
            },
            onPanResponderMove: (_, gesture) => {
                pan.setValue(gesture.dx);
            },
            onPanResponderRelease: (_, gesture) => {
                pan.flattenOffset();

                const orders = activeOrdersRef.current;
                const idx = currentIndexRef.current;

                // Check if it's a tap (minimal movement)
                if (Math.abs(gesture.dx) < 10 && Math.abs(gesture.dy) < 10) {
                    const order = orders[idx];
                    if (order?.id) {
                        setExpanded(false);
                        router.push(`/(main)/orders/${order.id}`);
                    }
                    pan.setValue(0);
                    return;
                }

                // Swipe left (next order) - flip animation
                if (gesture.dx < -swipeThreshold && idx < orders.length - 1) {
                    setIsFlipping(true);
                    // Flip out (rotate to 90deg)
                    Animated.timing(flipAnim, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                    }).start(() => {
                        setCurrentIndex(prev => prev + 1);
                        flipAnim.setValue(-1); // Jump to -90deg
                        // Flip in (rotate back to 0)
                        Animated.timing(flipAnim, {
                            toValue: 0,
                            duration: 150,
                            useNativeDriver: true,
                        }).start(() => setIsFlipping(false));
                    });
                    pan.setValue(0);
                }
                // Swipe right (previous order) - flip animation
                else if (gesture.dx > swipeThreshold && idx > 0) {
                    setIsFlipping(true);
                    // Flip out (rotate to -90deg)
                    Animated.timing(flipAnim, {
                        toValue: -1,
                        duration: 150,
                        useNativeDriver: true,
                    }).start(() => {
                        setCurrentIndex(prev => prev - 1);
                        flipAnim.setValue(1); // Jump to 90deg
                        // Flip in (rotate back to 0)
                        Animated.timing(flipAnim, {
                            toValue: 0,
                            duration: 150,
                            useNativeDriver: true,
                        }).start(() => setIsFlipping(false));
                    });
                    pan.setValue(0);
                }
                // Reset if not enough swipe
                else {
                    Animated.spring(pan, {
                        toValue: 0,
                        useNativeDriver: true,
                        friction: 8,
                    }).start();
                }
            },
        })
    ).current;

    if (activeOrders.length === 0) return null;

    const scale = animation.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
    const opacity = animation.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

    // Book page flip rotation
    const flipRotation = flipAnim.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-90deg', '0deg', '90deg'],
    });

    const currentOrder = activeOrders[currentIndex];

    return (
        <View style={expanded ? styles.containerExpanded : styles.containerCollapsed} pointerEvents="box-none">
            {expanded && (
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => toggleExpand()}
                >
                    <View style={{ flex: 1, backgroundColor: 'transparent' }} />
                </Pressable>
            )}

            {/* Card Widget - Positioned ABOVE the FAB */}
            <Animated.View
                style={[
                    styles.cardContainer,
                    { opacity, transform: [{ scale }] }
                ]}
                pointerEvents={expanded ? "auto" : "none"}
            >
                <View
                    {...panResponder.panHandlers}
                    style={styles.cardWrapper}
                >
                    <Animated.View style={[styles.card, { transform: [{ perspective: 800 }, { translateX: CARD_WIDTH / 2 }, { rotateY: flipRotation }, { translateX: -CARD_WIDTH / 2 }] }]}>
                        {activeOrders.length > 1 && (
                            <View style={styles.pageIndicator}>
                                <Text style={styles.pageText}>{currentIndex + 1}/{activeOrders.length}</Text>
                            </View>
                        )}
                        <CardContent order={currentOrder} formatTime={formatTime} />
                    </Animated.View>
                </View>
            </Animated.View>

            {/* Connector line between card and FAB */}
            {expanded && <View style={styles.connector} />}

            {/* FAB Button */}
            <Pressable onPress={() => toggleExpand()} style={styles.fabContainer}>
                <LinearGradient
                    colors={['#FF7D00', '#FF5722']}
                    style={styles.fab}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{activeOrders.length}</Text>
                    </View>
                    <Animated.View style={{ transform: [{ rotate: animation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
                        <IconButton icon={expanded ? "chevron-down" : "package-variant-closed"} iconColor="#fff" size={24} />
                    </Animated.View>
                </LinearGradient>
            </Pressable>
        </View >
    );
};

const styles = StyleSheet.create({
    containerCollapsed: {
        position: 'absolute',
        bottom: 100,
        right: 16,
        alignItems: 'flex-end',
        zIndex: 2000,
    },
    containerExpanded: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 2000,
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        paddingBottom: 100,
        paddingRight: 16,
    },
    cardContainer: {
        width: CARD_WIDTH,
        marginBottom: 8,
    },
    cardWrapper: {
        width: '100%',
    },
    connector: {
        height: 12,
        width: 2,
        backgroundColor: '#FF7D00',
        alignSelf: 'center',
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 10,
        width: '100%',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        borderWidth: 1,
        borderColor: '#FF7D0020',
        minHeight: 160,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
        paddingBottom: 6,
    },
    orderNumber: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#333',
    },
    orderTime: {
        fontSize: 9,
        color: '#999',
        marginTop: 1,
    },
    orderAmount: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#FF7D00',
    },
    trackingContainer: {
        paddingLeft: 2,
    },
    pageIndicator: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#333',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        zIndex: 10,
    },
    pageText: {
        color: 'white',
        fontSize: 8,
        fontWeight: 'bold',
    },
    fabContainer: {
        shadowColor: "#FF7D00",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        borderRadius: 28,
        zIndex: 2001,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#D32F2F',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        zIndex: 2,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        paddingHorizontal: 4,
    },
});
