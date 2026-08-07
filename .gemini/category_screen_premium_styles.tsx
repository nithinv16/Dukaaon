/**
 * PREMIUM STYLES FOR CATEGORY PRODUCTS SCREEN
 * Modern, Minimalist, Non-Generic Design
 * 
 * Apply these styles to replace the existing StyleSheet in category/[id].tsx
 * Starting around line 1200+
 */

const styles = StyleSheet.create({
    // ============================================================================
    // MAIN CONTAINER & LAYOUT
    // ============================================================================
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },

    // ============================================================================
    // SIDEBAR (Category Navigation)
    // ============================================================================
    sidebar: {
        width: 120,
        backgroundColor: 'transparent',
        paddingTop: 8,
    },
    sidebarContent: {
        paddingBottom: 20,
    },
    categoryItem: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        marginBottom: 4,
        marginHorizontal: 8,
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    selectedCategoryItem: {
        backgroundColor: COLORS.primaryLight,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary,
    },
    categoryContent: {
        flexDirection: 'column',
        alignItems: 'center',
    },
    categoryIcon: {
        width: 32,
        height: 32,
        marginBottom: 4,
    },
    categoryText: {
        fontSize: 12,
        color: COLORS.text,
        textAlign: 'center',
        fontWeight: '500',
    },
    selectedCategoryText: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    expandButton: {
        margin: 0,
        padding: 0,
    },
    subcategoriesContainer: {
        paddingLeft: 12,
        marginTop: 4,
    },
    subcategoryItem: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 2,
        borderRadius: 8,
    },
    selectedSubcategoryItem: {
        backgroundColor: COLORS.primaryLight,
    },
    subcategoryText: {
        fontSize: 11,
        color: COLORS.textLight,
    },
    selectedSubcategoryText: {
        color: COLORS.primary,
        fontWeight: '600',
    },

    // ============================================================================
    // PRODUCTS CONTAINER & LIST
    // ============================================================================
    productsContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    productsList: {
        padding: 12,
        paddingBottom: 80,
    },

    // ============================================================================
    // PRODUCT CARD - Premium Floating Design
    // ============================================================================
    productCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 16,
        marginBottom: 16,
        marginHorizontal: 6,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    wholesalerProductCard: {
        flex: 1,
        maxWidth: '48%',
    },
    categoryProductCard: {
        flex: 1,
        maxWidth: '31%',
    },
    productCardInner: {
        flex: 1,
    },
    imageContainer: {
        position: 'relative',
        width: '100%',
        aspectRatio: 1,
        backgroundColor: COLORS.inputBg,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    wishlistIcon: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 20,
        elevation: 2,
    },
    productInfo: {
        padding: 12,
    },
    nameContainer: {
        marginBottom: 8,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.secondary,
        lineHeight: 20,
        marginBottom: 4,
    },
    sellerName: {
        fontSize: 11,
        color: COLORS.textLight,
        marginTop: 2,
    },
    priceInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    price: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -0.5,
    },
    unit: {
        fontSize: 11,
        color: COLORS.textLight,
        marginLeft: 4,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.inputBg,
        borderRadius: 30,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginBottom: 8,
    },
    quantityButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.secondary,
        minWidth: 24,
        textAlign: 'center',
    },
    minQuantityText: {
        fontSize: 10,
        color: COLORS.textLight,
        textAlign: 'center',
        marginBottom: 4,
    },
    addToCartButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
        elevation: 2,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    addToCartButtonText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '700',
    },

    // ============================================================================
    // HEADER & SEARCH
    // ============================================================================
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBg,
        borderRadius: 12,
        paddingHorizontal: 12,
        marginHorizontal: 16,
        marginVertical: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 15,
        color: COLORS.text,
    },
    searchIcon: {
        marginLeft: 8,
    },

    // ============================================================================
    // FILTER BAR - Premium Pills
    // ============================================================================
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBg,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    filterButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
        marginLeft: 4,
    },

    // ============================================================================
    // MODALS - Clean & Modern
    // ============================================================================
    modalContainer: {
        backgroundColor: COLORS.white,
        margin: 20,
        borderRadius: 20,
        maxHeight: '80%',
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.secondary,
    },
    modalContent: {
        padding: 20,
    },
    filterSectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.secondary,
        marginTop: 16,
        marginBottom: 12,
    },
    priceRangeContainer: {
        backgroundColor: COLORS.inputBg,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    modalButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 14,
        marginHorizontal: 20,
        marginBottom: 20,
        alignItems: 'center',
    },
    modalButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },

    // ============================================================================
    // EMPTY STATE
    // ============================================================================
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyIcon: {
        width: 120,
        height: 120,
        marginBottom: 20,
        opacity: 0.5,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.secondary,
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: COLORS.textLight,
        textAlign: 'center',
        lineHeight: 22,
    },

    // ============================================================================
    // LOADING STATES
    // ============================================================================
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: COLORS.textLight,
    },
    loadingMoreContainer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
});

export default styles;
