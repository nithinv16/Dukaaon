import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { translationService, SupportedLanguage } from '../../services/translationService';
import { useLanguageStore } from '../../store/language';

// Types
interface OrderItem {
    id: string;
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    image_url?: string;
    unit?: string;
    min_quantity?: number;
    seller_name?: string;
}

interface OrderReviewCardProps {
    items: OrderItem[];
    unavailableItems?: string[];
    onConfirmOrder: (items: OrderItem[]) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

const COLORS = {
    orange: '#FF7D00',
    lightOrange: '#FFA64D',
    white: '#FFFFFF',
    offWhite: '#F8F9FA',
    darkBlueGrey: '#1E2A3A',
    grey: '#8E8E93',
    lightGrey: '#E5E5EA',
    success: '#34C759',
    danger: '#FF3B30',
};

const OrderReviewCard: React.FC<OrderReviewCardProps> = ({
    items: initialItems,
    unavailableItems = [],
    onConfirmOrder,
    onCancel,
    isLoading = false,
}) => {
    const [items, setItems] = useState<OrderItem[]>(initialItems);
    const currentLanguage = useLanguageStore(state => state.language);

    // Original texts for translation
    const originalTexts = {
        reviewYourOrder: 'Review Your Order',
        noItemsInOrder: 'No items in order',
        unavailableItems: 'Unavailable Items',
        items: 'Items',
        subtotal: 'Subtotal',
        cancel: 'Cancel',
        confirmOrder: 'Confirm Order',
        min: 'Min',
    };

    // Translations state
    const [translations, setTranslations] = useState(originalTexts);

    // Load translations
    useEffect(() => {
        const loadTranslations = async () => {
            if (currentLanguage === 'en') {
                setTranslations(originalTexts);
                return;
            }

            try {
                const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
                    const translated = await translationService.translateText(value, currentLanguage as SupportedLanguage);
                    return [key, translated.translatedText];
                });

                const translatedEntries = await Promise.all(translationPromises);
                setTranslations(Object.fromEntries(translatedEntries));
            } catch (error) {
                console.error('[OrderReviewCard] Translation error:', error);
            }
        };

        loadTranslations();
    }, [currentLanguage]);

    // Translation function
    const t = (key: string) => (translations as Record<string, string>)[key] || (originalTexts as Record<string, string>)[key] || key;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

    // Handle quantity change
    const handleQuantityChange = (id: string, newQuantity: number) => {
        if (newQuantity < 1) return;
        setItems(prev =>
            prev.map(item =>
                item.id === id ? { ...item, quantity: newQuantity } : item
            )
        );
    };

    // Handle remove item
    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // Handle confirm
    const handleConfirm = () => {
        if (items.length === 0) return;
        onConfirmOrder(items);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={[COLORS.orange, COLORS.lightOrange]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.header}
            >
                <MaterialCommunityIcons name="clipboard-check-outline" size={24} color={COLORS.white} />
                <Text style={styles.headerTitle}>{t('reviewYourOrder')}</Text>
            </LinearGradient>

            {/* Items List */}
            <ScrollView style={styles.itemsList} nestedScrollEnabled>
                {items.map((item, index) => (
                    <View key={item.id} style={styles.itemRow}>
                        {/* Top Row: Index, Image, Name, Delete */}
                        <View style={styles.itemTopRow}>
                            <Text style={styles.itemIndex}>{index + 1}</Text>
                            {item.image_url ? (
                                <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                            ) : (
                                <View style={styles.imagePlaceholder}>
                                    <Ionicons name="cube-outline" size={18} color={COLORS.grey} />
                                </View>
                            )}
                            <View style={styles.itemDetails}>
                                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                                <View style={styles.itemMetaRow}>
                                    {item.min_quantity && item.min_quantity > 1 && (
                                        <View style={styles.minQtyBadge}>
                                            <Text style={styles.minQtyText}>{t('min')}: {item.min_quantity}</Text>
                                        </View>
                                    )}
                                    {item.seller_name && (
                                        <Text style={styles.sellerName} numberOfLines={1}>
                                            <Ionicons name="storefront-outline" size={11} color={COLORS.grey} /> {item.seller_name}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => handleRemoveItem(item.id)}
                            >
                                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                            </TouchableOpacity>
                        </View>

                        {/* Bottom Row: Price, Quantity, Total */}
                        <View style={styles.itemBottomRow}>
                            <Text style={styles.itemPrice}>₹{item.unit_price.toFixed(2)}</Text>

                            <View style={styles.quantityContainer}>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => handleQuantityChange(item.id, item.quantity - 1)}
                                >
                                    <Ionicons name="remove" size={18} color={COLORS.orange} />
                                </TouchableOpacity>
                                <TextInput
                                    style={styles.quantityInput}
                                    value={item.quantity.toString()}
                                    onChangeText={(text) => {
                                        const qty = parseInt(text) || 1;
                                        handleQuantityChange(item.id, qty);
                                    }}
                                    keyboardType="number-pad"
                                    selectTextOnFocus
                                />
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => handleQuantityChange(item.id, item.quantity + 1)}
                                >
                                    <Ionicons name="add" size={18} color={COLORS.orange} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.itemTotal}>₹{(item.quantity * item.unit_price).toFixed(2)}</Text>
                        </View>
                    </View>
                ))}

                {items.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="cart-outline" size={40} color={COLORS.grey} />
                        <Text style={styles.emptyText}>{t('noItemsInOrder')}</Text>
                    </View>
                )}
            </ScrollView>

            {/* Unavailable Items */}
            {unavailableItems.length > 0 && (
                <View style={styles.unavailableSection}>
                    <View style={styles.unavailableHeader}>
                        <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
                        <Text style={styles.unavailableTitle}>{t('unavailableItems')} ({unavailableItems.length})</Text>
                    </View>
                    <Text style={styles.unavailableList}>
                        {unavailableItems.join(', ')}
                    </Text>
                </View>
            )}

            {/* Summary */}
            <View style={styles.summarySection}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t('items')}</Text>
                    <Text style={styles.summaryValue}>{items.length}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t('subtotal')}</Text>
                    <Text style={styles.subtotalValue}>₹{subtotal.toFixed(2)}</Text>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={isLoading}>
                    <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.confirmButton, items.length === 0 && styles.buttonDisabled]}
                    onPress={handleConfirm}
                    disabled={items.length === 0 || isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                            <Text style={styles.confirmButtonText}>{t('confirmOrder')}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        overflow: 'hidden',
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.white,
    },
    itemsList: {
        maxHeight: 350,
        paddingHorizontal: 12,
    },
    itemRow: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGrey,
    },
    itemTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    itemBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginLeft: 24,  // Align with product name
    },
    itemIndex: {
        width: 20,
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.grey,
        textAlign: 'center',
    },
    itemImage: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: COLORS.offWhite,
        marginHorizontal: 8,
    },
    imagePlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: COLORS.offWhite,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    itemDetails: {
        flex: 1,
        marginRight: 8,
    },
    itemName: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.darkBlueGrey,
        lineHeight: 20,
    },
    itemMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        flexWrap: 'wrap',
        gap: 6,
    },
    minQtyBadge: {
        backgroundColor: '#FFF3E6',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.orange,
    },
    minQtyText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.orange,
    },
    sellerName: {
        fontSize: 11,
        color: COLORS.grey,
        flex: 1,
    },
    itemUnit: {
        fontSize: 12,
        color: COLORS.grey,
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.darkBlueGrey,
        minWidth: 60,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.offWhite,
        borderRadius: 10,
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    quantityButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityInput: {
        width: 40,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.darkBlueGrey,
    },
    itemTotal: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.orange,
        minWidth: 70,
        textAlign: 'right',
    },
    removeButton: {
        padding: 8,
    },
    itemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        marginTop: 8,
        fontSize: 14,
        color: COLORS.grey,
    },
    unavailableSection: {
        backgroundColor: '#FFF5F5',
        padding: 12,
        marginHorizontal: 12,
        marginTop: 8,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.danger,
    },
    unavailableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    unavailableTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.danger,
    },
    unavailableList: {
        fontSize: 12,
        color: '#666',
        lineHeight: 18,
    },
    summarySection: {
        backgroundColor: COLORS.offWhite,
        padding: 16,
        marginTop: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: COLORS.grey,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.darkBlueGrey,
    },
    subtotalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.orange,
    },
    actionButtons: {
        flexDirection: 'row',
        padding: 12,
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.lightGrey,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.grey,
    },
    confirmButton: {
        flex: 2,
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: COLORS.success,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.white,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});

export default OrderReviewCard;
