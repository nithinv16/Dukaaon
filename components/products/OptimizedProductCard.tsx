import React, { memo, useState, useCallback, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { IconButton } from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';

interface Product {
    id: string;
    name: string;
    price: number;
    image_url: string;
    min_quantity: number;
    unit: string;
    seller_id: string;
    brand?: string;
    incrementUnit?: number;
    seller_details?: {
        business_name: string;
        seller_type: string;
    };
}

interface OptimizedProductCardProps {
    product: Product;
    initialQuantity?: number;
    cartQuantity?: number; // Quantity currently in cart (0 if not in cart)
    inWishlist: boolean;
    isWholesalerView: boolean;
    onPress: (productId: string) => void;
    onAddToCart: (product: Product, startX?: number, startY?: number) => void;
    onUpdateCartQuantity?: (productId: string, quantity: number) => void;
    onWishlistToggle: (productId: string, add: boolean) => void;
    onSellerPress?: (sellerId: string) => void;
}

// Colors
const COLORS = {
    primary: '#FF7D00',
    primaryLight: '#FFF3E0',
    success: '#34C759',
    successLight: '#E8F5E9',
    text: '#333',
    textLight: '#888',
    background: '#F8F9FA',
    white: '#FFFFFF',
};

// Original texts for translation
const originalTexts = {
    addToCart: 'Add to Cart',
    inCart: 'in cart',
    min: 'Min',
};

const OptimizedProductCard = memo(({
    product,
    initialQuantity,
    cartQuantity = 0,
    inWishlist,
    isWholesalerView,
    onPress,
    onAddToCart,
    onUpdateCartQuantity,
    onWishlistToggle,
    onSellerPress,
}: OptimizedProductCardProps) => {
    const { currentLanguage } = useLanguage();

    // Translation state
    const [translations, setTranslations] = useState(originalTexts);

    // Load translations when language changes
    useEffect(() => {
        const loadTranslations = async () => {
            if (!currentLanguage || currentLanguage === 'en') {
                setTranslations(originalTexts);
                return;
            }

            try {
                const keys = Object.keys(originalTexts);
                const values = Object.values(originalTexts);
                const results = await translationService.translateBatch(values, currentLanguage);

                const newTranslations: Record<string, string> = {};
                keys.forEach((key, index) => {
                    newTranslations[key] = results[index]?.translatedText || originalTexts[key as keyof typeof originalTexts];
                });
                setTranslations(newTranslations as typeof originalTexts);
            } catch (error) {
                // Fallback to original
                setTranslations(originalTexts);
            }
        };

        loadTranslations();
    }, [currentLanguage]);

    // Local state for quantity - prevents parent re-renders
    const [quantity, setQuantity] = useState(initialQuantity || product.min_quantity);
    const [isInCart, setIsInCart] = useState(cartQuantity > 0);
    const [localCartQty, setLocalCartQty] = useState(cartQuantity);
    const incrementAmount = product.incrementUnit || 1;

    // Sync with cart quantity prop
    useEffect(() => {
        if (cartQuantity > 0) {
            setIsInCart(true);
            setLocalCartQty(cartQuantity);
        }
    }, [cartQuantity]);

    const handleDecrement = useCallback(() => {
        setQuantity(prev => Math.max(product.min_quantity, prev - incrementAmount));
    }, [product.min_quantity, incrementAmount]);

    const handleIncrement = useCallback(() => {
        setQuantity(prev => prev + incrementAmount);
    }, [incrementAmount]);

    // Cart quantity controls
    const handleCartQtyDecrement = useCallback(() => {
        const newQty = Math.max(0, localCartQty - incrementAmount);
        setLocalCartQty(newQty);
        if (newQty === 0) {
            setIsInCart(false);
        }
        onUpdateCartQuantity?.(product.id, newQty);
    }, [localCartQty, incrementAmount, product.id, onUpdateCartQuantity]);

    const handleCartQtyIncrement = useCallback(() => {
        const newQty = localCartQty + incrementAmount;
        setLocalCartQty(newQty);
        onUpdateCartQuantity?.(product.id, newQty);
    }, [localCartQty, incrementAmount, product.id, onUpdateCartQuantity]);

    const handleAddToCart = useCallback((event: any) => {
        const { pageX, pageY } = event.nativeEvent;
        // Create a modified product with current quantity
        const productWithQuantity = { ...product, quantity };
        // Start from tap position
        onAddToCart(productWithQuantity as any, pageX, pageY);
        // Mark as in cart
        setIsInCart(true);
        setLocalCartQty(quantity);
    }, [product, quantity, onAddToCart]);

    return (
        <View style={[styles.productCard, isWholesalerView ? styles.wholesalerCard : styles.categoryCard]}>
            <View style={styles.productCardInner}>
                <TouchableOpacity
                    style={styles.imageContainer}
                    onPress={() => onPress(product.id)}
                    activeOpacity={0.7}
                >
                    <Image
                        source={typeof product.image_url === 'string' ? { uri: product.image_url } : product.image_url as any}
                        style={styles.productImage}
                    />
                    <IconButton
                        icon={inWishlist ? "heart" : "heart-outline"}
                        iconColor={inWishlist ? "#FF0000" : "#666"}
                        size={20}
                        style={styles.wishlistIcon}
                        onPress={() => onWishlistToggle(product.id, !inWishlist)}
                    />
                    {isInCart && (
                        <View style={styles.inCartBadge}>
                            <Ionicons name="checkmark" size={12} color={COLORS.white} />
                        </View>
                    )}
                </TouchableOpacity>

                <View style={styles.productInfo}>
                    <TouchableOpacity
                        style={styles.nameContainer}
                        onPress={() => onPress(product.id)}
                        activeOpacity={0.7}
                    >
                        <Text numberOfLines={2} style={styles.productName}>
                            {product.name || 'Product Name'}
                        </Text>
                        {product.seller_details?.business_name && (
                            <TouchableOpacity
                                onPress={() => onSellerPress && onSellerPress(product.seller_id)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.sellerName} numberOfLines={1}>
                                    {product.seller_details.business_name}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>

                    <View style={styles.priceInfo}>
                        <Text style={styles.price}>₹{product.price}</Text>
                    </View>

                    {/* Show quantity selector only when NOT in cart */}
                    {!isInCart && (
                        <View style={styles.quantitySection}>
                            {product.min_quantity > 1 && (
                                <Text style={styles.minQuantity}>{translations.min}: {product.min_quantity}</Text>
                            )}
                            <View style={styles.quantityControls}>
                                <IconButton
                                    icon="minus"
                                    size={18}
                                    style={styles.quantityButton}
                                    iconColor={COLORS.primary}
                                    disabled={quantity <= product.min_quantity}
                                    onPress={handleDecrement}
                                />
                                <Text style={styles.quantityText}>{quantity}</Text>
                                <IconButton
                                    icon="plus"
                                    size={18}
                                    style={styles.quantityButton}
                                    iconColor={COLORS.primary}
                                    onPress={handleIncrement}
                                />
                            </View>
                        </View>
                    )}

                    {/* Add to Cart Button OR In-Cart Controls */}
                    {isInCart ? (
                        <View style={styles.inCartContainer}>
                            <View style={styles.inCartControls}>
                                <Pressable
                                    style={styles.cartQtyBtn}
                                    onPress={handleCartQtyDecrement}
                                >
                                    <MaterialCommunityIcons
                                        name={localCartQty <= incrementAmount ? "trash-can-outline" : "minus"}
                                        size={16}
                                        color={COLORS.success}
                                    />
                                </Pressable>
                                <View style={styles.cartQtyDisplay}>
                                    <Text style={styles.cartQtyText}>{localCartQty}</Text>
                                    <Text style={styles.cartQtyLabel}>{translations.inCart}</Text>
                                </View>
                                <Pressable
                                    style={styles.cartQtyBtn}
                                    onPress={handleCartQtyIncrement}
                                >
                                    <MaterialCommunityIcons name="plus" size={16} color={COLORS.success} />
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.addButtonContainer}
                            onPress={handleAddToCart}
                            activeOpacity={0.8}
                        >
                            <View style={styles.addButton}>
                                <Ionicons name="cart-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                                <Text style={styles.buttonLabel}>{translations.addToCart}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}, (prevProps, nextProps) => {
    // Custom comparison - only re-render if these change
    return (
        prevProps.product.id === nextProps.product.id &&
        prevProps.product.price === nextProps.product.price &&
        prevProps.inWishlist === nextProps.inWishlist &&
        prevProps.isWholesalerView === nextProps.isWholesalerView &&
        prevProps.cartQuantity === nextProps.cartQuantity
    );
});

const styles = StyleSheet.create({
    productCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    wholesalerCard: {
        width: '48%',
        marginHorizontal: '1%',
    },
    categoryCard: {
        width: '31%',
        marginHorizontal: '1%',
    },
    productCardInner: {
        overflow: 'hidden',
        borderRadius: 16,
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: COLORS.background,
        position: 'relative',
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    wishlistIcon: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 20,
        margin: 0,
    },
    inCartBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        backgroundColor: COLORS.success,
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    productInfo: {
        padding: 10,
    },
    nameContainer: {
        marginBottom: 6,
    },
    productName: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
        lineHeight: 18,
    },
    sellerName: {
        fontSize: 11,
        color: COLORS.textLight,
        marginTop: 2,
    },
    priceInfo: {
        marginBottom: 8,
    },
    price: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    quantitySection: {
        marginBottom: 8,
    },
    minQuantity: {
        fontSize: 10,
        color: COLORS.textLight,
        marginBottom: 4,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 20,
        paddingVertical: 2,
    },
    quantityButton: {
        margin: 0,
        width: 28,
        height: 28,
    },
    quantityText: {
        fontSize: 14,
        fontWeight: '600',
        minWidth: 24,
        textAlign: 'center',
    },
    addButtonContainer: {
        marginTop: 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 10,
    },
    buttonLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    // In-cart styles
    inCartContainer: {
        marginTop: 4,
    },
    inCartControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.successLight,
        borderRadius: 12,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    cartQtyBtn: {
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
    },
    cartQtyDisplay: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    cartQtyText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.success,
    },
    cartQtyLabel: {
        fontSize: 9,
        color: COLORS.success,
        fontWeight: '500',
        textTransform: 'uppercase',
    },
});

export default OptimizedProductCard;
