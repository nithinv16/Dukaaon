import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useInstantTranslation } from '../../hooks/useInstantTranslation';

// Original texts for translation
const ORIGINAL_TEXTS = {
    searchResults: 'Search Results',
    options: 'Options',
    noProductsFound: 'No products found',
    noItemsSelected: 'No items selected',
    min: 'Min',
    inStock: 'in stock',
    items: 'Items',
    subtotal: 'Subtotal',
    addToCart: 'Add to Cart',
    placeOrder: 'Place Order',
    orderPlaced: '✓ Order Placed Successfully!',
    addedToCart: '✓ Added to Cart!',
    viewMoreOptions: 'View More Options',
};

// Types
export interface ProductSearchResult {
    id: string;
    product_id: string;
    name: string;
    price: number;
    unit?: string;
    min_quantity?: number;
    stock_available?: number;
    seller_name?: string;
    seller_id?: string;
    distance_km?: number;
    image_url?: string;
    category?: string;
    subcategory?: string;
    brand?: string;
}

interface ProductSearchResultsCardProps {
    products: ProductSearchResult[];
    searchQuery?: string;
    onSelectProduct: (product: ProductSearchResult, quantity: number) => void;
    onPlaceOrder?: (items: Array<{ product: ProductSearchResult; quantity: number }>) => void;
    onViewMore?: () => void;
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

const ProductSearchResultsCard: React.FC<ProductSearchResultsCardProps> = ({
    products,
    searchQuery,
    onSelectProduct,
    onPlaceOrder,
    onViewMore,
    isLoading = false,
}) => {
    const { t } = useInstantTranslation(ORIGINAL_TEXTS);
    const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
    const [visibleProducts, setVisibleProducts] = useState<ProductSearchResult[]>(products);
    const [actionCompleted, setActionCompleted] = useState<'cart' | 'order' | null>(null);
    const [translatedNames, setTranslatedNames] = useState<{ [key: string]: string }>({});

    // Animation values
    const buttonOpacity = useRef(new Animated.Value(1)).current;
    const successOpacity = useRef(new Animated.Value(0)).current;
    const successScale = useRef(new Animated.Value(0.5)).current;

    // Product names should NOT be translated - they are brand names/proper nouns
    // Keep product names in their original form
    useEffect(() => {
        const names: { [key: string]: string } = {};
        products.forEach(p => { names[p.id] = p.name; });
        setTranslatedNames(names);
    }, [products]);

    // Initialize quantities with min_quantity
    React.useEffect(() => {
        const initialQuantities: { [key: string]: number } = {};
        products.forEach(product => {
            initialQuantities[product.id] = product.min_quantity || 1;
        });
        setQuantities(initialQuantities);
        setVisibleProducts(products);
        // Reset action state when products change
        setActionCompleted(null);
        buttonOpacity.setValue(1);
        successOpacity.setValue(0);
        successScale.setValue(0.5);
    }, [products]);

    // Animate success state
    const animateSuccess = (type: 'cart' | 'order') => {
        setActionCompleted(type);

        // Fade out buttons
        Animated.timing(buttonOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();

        // Show success message with scale and fade
        Animated.parallel([
            Animated.timing(successOpacity, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(successScale, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    };

    // Handle quantity change (for +/- buttons)
    const handleQuantityChange = (id: string, newQuantity: number) => {
        const product = visibleProducts.find(p => p.id === id);
        const minQty = product?.min_quantity || 1;
        // Enforce min quantity for button clicks
        const finalQty = Math.max(minQty, newQuantity);
        setQuantities(prev => ({
            ...prev,
            [id]: finalQty
        }));
    };

    // Handle quantity input change (allow typing freely)
    const handleQuantityInputChange = (id: string, text: string) => {
        // Allow empty string while typing
        if (text === '') {
            setQuantities(prev => ({
                ...prev,
                [id]: 0 // Temporary value, will be corrected on blur
            }));
            return;
        }
        // Remove any non-numeric characters
        const numericText = text.replace(/[^0-9]/g, '');
        if (numericText === '') {
            setQuantities(prev => ({
                ...prev,
                [id]: 0
            }));
            return;
        }
        const qty = parseInt(numericText);
        if (!isNaN(qty) && qty >= 0) {
            setQuantities(prev => ({
                ...prev,
                [id]: qty
            }));
        }
    };

    // Handle quantity input blur (enforce min quantity)
    const handleQuantityBlur = (id: string) => {
        const product = visibleProducts.find(p => p.id === id);
        const minQty = product?.min_quantity || 1;
        const currentQty = quantities[id] || 0;

        if (currentQty < minQty) {
            setQuantities(prev => ({
                ...prev,
                [id]: minQty
            }));
        }
    };

    // Handle remove item
    const handleRemoveItem = (id: string) => {
        setVisibleProducts(prev => prev.filter(item => item.id !== id));
    };

    // Handle add to cart (single product)
    const handleAddToCart = (product: ProductSearchResult) => {
        if (actionCompleted) return; // Prevent multiple actions
        const quantity = quantities[product.id] || product.min_quantity || 1;
        onSelectProduct(product, quantity);
        // Note: Single product add doesn't fade out the whole card
    };

    // Handle confirm - add all visible products to cart
    const handleConfirm = () => {
        if (actionCompleted) return; // Prevent multiple actions
        visibleProducts.forEach(product => {
            const quantity = quantities[product.id] || product.min_quantity || 1;
            onSelectProduct(product, quantity);
        });
        // Trigger fade out animation
        animateSuccess('cart');
    };

    // Handle place order - place order with all visible products
    const handlePlaceOrder = () => {
        if (!onPlaceOrder || visibleProducts.length === 0 || actionCompleted) return;
        const items = visibleProducts.map(product => ({
            product,
            quantity: quantities[product.id] || product.min_quantity || 1
        }));
        onPlaceOrder(items);
        // Trigger fade out animation
        animateSuccess('order');
    };

    // Calculate totals
    const subtotal = visibleProducts.reduce((sum, product) => {
        const quantity = quantities[product.id] || product.min_quantity || 1;
        return sum + quantity * product.price;
    }, 0);

    if (products.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={40} color={COLORS.grey} />
                    <Text style={styles.emptyText}>{t.noProductsFound}</Text>
                </View>
            </View>
        );
    }

    if (visibleProducts.length === 0) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={[COLORS.orange, COLORS.lightOrange]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.header}
                >
                    <MaterialCommunityIcons name="magnify" size={24} color={COLORS.white} />
                    <Text style={styles.headerTitle}>
                        {searchQuery ? `${searchQuery} ${t.options}` : t.searchResults}
                    </Text>
                </LinearGradient>
                <View style={styles.emptyState}>
                    <Ionicons name="cart-outline" size={40} color={COLORS.grey} />
                    <Text style={styles.emptyText}>{t.noItemsSelected}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header - Similar to OrderReviewCard */}
            <LinearGradient
                colors={[COLORS.orange, COLORS.lightOrange]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.header}
            >
                <MaterialCommunityIcons name="magnify" size={24} color={COLORS.white} />
                <Text style={styles.headerTitle}>
                    {searchQuery ? `${searchQuery} ${t.options}` : t.searchResults}
                </Text>
                <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{products.length}</Text>
                </View>
            </LinearGradient>

            {/* Items List - Same layout as OrderReviewCard */}
            <ScrollView
                style={styles.itemsList}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
            >
                {visibleProducts.map((product, index) => (
                    <View key={product.id} style={styles.itemRow}>
                        {/* Top Row: Index, Image, Name, Seller, Delete */}
                        <View style={styles.itemTopRow}>
                            <Text style={styles.itemIndex}>{index + 1}</Text>
                            {product.image_url ? (
                                <Image source={{ uri: product.image_url }} style={styles.itemImage} />
                            ) : (
                                <View style={styles.imagePlaceholder}>
                                    <Ionicons name="cube-outline" size={18} color={COLORS.grey} />
                                </View>
                            )}
                            <View style={styles.itemDetails}>
                                <Text style={styles.itemName} numberOfLines={2}>{translatedNames[product.id] || product.name}</Text>
                                <View style={styles.itemMetaRow}>
                                    {product.min_quantity && product.min_quantity > 1 && (
                                        <View style={styles.minQtyBadge}>
                                            <Text style={styles.minQtyText}>{t.min}: {product.min_quantity}</Text>
                                        </View>
                                    )}
                                    {product.seller_name && (
                                        <Text style={styles.sellerName} numberOfLines={1}>
                                            <Ionicons name="storefront-outline" size={11} color={COLORS.grey} /> {product.seller_name}
                                        </Text>
                                    )}
                                    {product.stock_available !== undefined && (
                                        <Text style={styles.stockText}>
                                            {product.stock_available} {t.inStock}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => handleRemoveItem(product.id)}
                            >
                                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                            </TouchableOpacity>
                        </View>

                        {/* Bottom Row: Price, Quantity, Total, Add to Cart */}
                        <View style={styles.itemBottomRow}>
                            <Text style={styles.itemPrice}>₹{product.price.toFixed(2)}</Text>

                            <View style={styles.quantityContainer}>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => handleQuantityChange(product.id, (quantities[product.id] || product.min_quantity || 1) - 1)}
                                >
                                    <Ionicons name="remove" size={18} color={COLORS.orange} />
                                </TouchableOpacity>
                                <TextInput
                                    style={styles.quantityInput}
                                    value={quantities[product.id] !== undefined ? quantities[product.id].toString() : (product.min_quantity || 1).toString()}
                                    onChangeText={(text) => handleQuantityInputChange(product.id, text)}
                                    onBlur={() => handleQuantityBlur(product.id)}
                                    keyboardType="number-pad"
                                    selectTextOnFocus
                                    editable={true}
                                />
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => handleQuantityChange(product.id, (quantities[product.id] || product.min_quantity || 1) + 1)}
                                >
                                    <Ionicons name="add" size={18} color={COLORS.orange} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.itemTotal}>
                                ₹{((quantities[product.id] || product.min_quantity || 1) * product.price).toFixed(2)}
                            </Text>

                            {/* Add to Cart Button */}
                            <TouchableOpacity
                                style={styles.addToCartButtonSmall}
                                onPress={() => handleAddToCart(product)}
                            >
                                <Ionicons name="cart" size={16} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}

                {visibleProducts.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="cart-outline" size={40} color={COLORS.grey} />
                        <Text style={styles.emptyText}>{t.noItemsSelected}</Text>
                    </View>
                )}
            </ScrollView>

            {/* Summary */}
            <View style={styles.summarySection}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t.items}</Text>
                    <Text style={styles.summaryValue}>{visibleProducts.length}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t.subtotal}</Text>
                    <Text style={styles.subtotalValue}>₹{subtotal.toFixed(2)}</Text>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
                {/* Animated Buttons */}
                <Animated.View style={[styles.actionButtons, { opacity: buttonOpacity }]}>
                    <TouchableOpacity
                        style={[
                            styles.addToCartButton,
                            (visibleProducts.length === 0 || isLoading || actionCompleted) && styles.buttonDisabled
                        ]}
                        onPress={handleConfirm}
                        disabled={visibleProducts.length === 0 || isLoading || !!actionCompleted}
                    >
                        <Ionicons name="cart" size={18} color={COLORS.white} />
                        <Text style={styles.addToCartButtonText}>{t.addToCart}</Text>
                    </TouchableOpacity>

                    {onPlaceOrder && (
                        <TouchableOpacity
                            style={[
                                styles.placeOrderButton,
                                (visibleProducts.length === 0 || isLoading || actionCompleted) && styles.buttonDisabled
                            ]}
                            onPress={handlePlaceOrder}
                            disabled={visibleProducts.length === 0 || isLoading || !!actionCompleted}
                        >
                            <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                            <Text style={styles.placeOrderButtonText}>{t.placeOrder}</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>

                {/* Success Message - Shows after action */}
                {actionCompleted && (
                    <Animated.View
                        style={[
                            styles.successMessage,
                            {
                                opacity: successOpacity,
                                transform: [{ scale: successScale }]
                            }
                        ]}
                    >
                        <LinearGradient
                            colors={actionCompleted === 'order' ? ['#34C759', '#2DB84D'] : [COLORS.orange, COLORS.lightOrange]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.successGradient}
                        >
                            <Ionicons
                                name={actionCompleted === 'order' ? 'checkmark-circle' : 'cart'}
                                size={24}
                                color={COLORS.white}
                            />
                            <Text style={styles.successText}>
                                {actionCompleted === 'order'
                                    ? t.orderPlaced
                                    : t.addedToCart}
                            </Text>
                        </LinearGradient>
                    </Animated.View>
                )}
            </View>

            {/* View More Button */}
            {onViewMore && products.length >= 3 && (
                <TouchableOpacity style={styles.viewMoreButton} onPress={onViewMore}>
                    <Text style={styles.viewMoreText}>{t.viewMoreOptions}</Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.orange} />
                </TouchableOpacity>
            )}
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
        flex: 1,
    },
    headerBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    headerBadgeText: {
        fontSize: 14,
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
        marginLeft: 24,
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
    stockText: {
        fontSize: 10,
        color: COLORS.success,
        fontWeight: '500',
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.darkBlueGrey,
        minWidth: 55,
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
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityInput: {
        width: 36,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.darkBlueGrey,
    },
    itemTotal: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.orange,
        minWidth: 60,
        textAlign: 'right',
    },
    addToCartButtonSmall: {
        backgroundColor: COLORS.success,
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    removeButton: {
        padding: 8,
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
    actionButtonsContainer: {
        position: 'relative',
        minHeight: 70,
    },
    actionButtons: {
        flexDirection: 'row',
        padding: 12,
        gap: 12,
    },
    addToCartButton: {
        flex: 1.2,
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: COLORS.orange,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    addToCartButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.white,
    },
    placeOrderButton: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: COLORS.success,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    placeOrderButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.white,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    successMessage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
    },
    successGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 10,
        width: '100%',
    },
    successText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.white,
    },
    viewMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGrey,
        gap: 6,
    },
    viewMoreText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.orange,
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
});

export default ProductSearchResultsCard;
