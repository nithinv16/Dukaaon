import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { dynamicCategoryService } from '../../services/dynamic/dynamicCategoryService';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';
import { getCategoryImage } from '../../constants/categoryImages';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width * 0.25; // Each column takes ~25% of screen width (showing ~4 columns aka 8 items)

interface Category {
    id: string;
    name: string;
    slug: string;
    image_url?: string;
    display_order: number;
}

interface CategoryCarouselProps {
    title?: string;
    limit?: number;
    showProductCount?: boolean;
}

export function CategoryCarousel({
    title = 'Shop by Category',
    limit = 20, // Increased limit for 2 rows
    showProductCount = false,
}: CategoryCarouselProps) {
    const router = useRouter();
    const { currentLanguage } = useLanguage();
    // OPTIMIZATION: Initialize with cached categories SYNCHRONOUSLY
    const [categories, setCategories] = useState<Category[]>(() => {
        const cached = dynamicCategoryService.getCategoriesSync();
        return cached.slice(0, limit);
    });
    const [loading, setLoading] = useState(false); // Start as false - show cached content immediately
    const [translatedTitle, setTranslatedTitle] = useState(title);

    // Translate title (non-blocking)
    useEffect(() => {
        if (currentLanguage === 'en') {
            setTranslatedTitle(title);
            return;
        }
        // Check cache first for instant display
        const cached = translationService.getCachedTranslationSync(title, currentLanguage);
        if (cached) {
            setTranslatedTitle(cached);
        }
        // Translate in background if not cached
        translationService.translateText(title, currentLanguage)
            .then(result => setTranslatedTitle(result.translatedText))
            .catch(() => { }); // Keep original on error
    }, [title, currentLanguage]);

    // Store original (English) categories for re-translation when language changes
    const [originalCategories, setOriginalCategories] = React.useState<Category[]>([]);

    // Fetch categories ONCE - do NOT depend on currentLanguage
    useEffect(() => {
        let isMounted = true;

        const fetchCategories = async () => {
            try {
                // Only show loading if we don't have ANY cached data
                const cachedData = dynamicCategoryService.getCategoriesSync();
                if (cachedData.length === 0) {
                    setLoading(true);
                }

                const data = await dynamicCategoryService.getCategories();

                if (!isMounted) return;

                if (data && data.length > 0) {
                    // Apply limit
                    const limitedData = data.slice(0, limit);

                    // Store original data for re-translation
                    setOriginalCategories(limitedData);

                    // Show categories immediately (in English)
                    setCategories(limitedData);
                    setLoading(false);
                } else {
                    setCategories([]);
                    setOriginalCategories([]);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error fetching categories for carousel:', error);
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchCategories();

        return () => {
            isMounted = false;
        };
    }, [limit]); // Only depend on limit, NOT currentLanguage

    // Translate categories when language changes (uses already-fetched data)
    useEffect(() => {
        if (originalCategories.length === 0) return;

        if (currentLanguage === 'en') {
            // Reset to English
            setCategories(originalCategories);
            return;
        }

        let isMounted = true;

        const translateCategories = async () => {
            try {
                // Use batch translation for efficiency (single API call)
                const names = originalCategories.map(cat => cat.name);
                const results = await translationService.translateBatch(names, currentLanguage);

                if (!isMounted) return;

                // Update with translated names
                const translatedCats = originalCategories.map((cat, i) => ({
                    ...cat,
                    name: results[i]?.translatedText || cat.name
                }));
                setCategories(translatedCats);
            } catch (error) {
                console.error('Error translating categories:', error);
            }
        };

        translateCategories();

        return () => {
            isMounted = false;
        };
    }, [currentLanguage, originalCategories]);

    const handleCategoryPress = (category: Category) => {
        const categoryParams = new URLSearchParams({
            type: 'category',
            name: category.name
        });
        router.push(`/(main)/screens/category/${category.id}?${categoryParams.toString()}`);
    };

    const getImageSource = (item: Category) => {
        if (item.image_url) return { uri: item.image_url };
        return getCategoryImage(item.slug);
    };

    // Chunk data into groups of 2 for the vertical column layout
    const chunkedCategories = React.useMemo(() => {
        const chunks = [];
        for (let i = 0; i < categories.length; i += 2) {
            chunks.push(categories.slice(i, i + 2));
        }
        return chunks;
    }, [categories]);

    // Show minimal skeleton while loading (title + small indicator)
    // This provides visual feedback without blocking the entire UI
    if (categories.length === 0) {
        if (loading) {
            return (
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text variant="titleLarge" style={styles.title}>{translatedTitle}</Text>
                    </View>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#FF7D00" />
                    </View>
                </View>
            );
        }
        return null; // No data and not loading - hide completely
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text variant="titleLarge" style={styles.title}>{translatedTitle}</Text>
                <TouchableOpacity onPress={() => router.push('/(main)/screens/categories')}>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={chunkedCategories}
                keyExtractor={(_, index) => `chunk-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                renderItem={({ item: chunk }) => (
                    <View style={styles.column}>
                        {chunk.map((category) => (
                            <TouchableOpacity
                                key={category.id}
                                style={styles.cardContainer}
                                onPress={() => handleCategoryPress(category)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.imageWrapper}>
                                    <Image
                                        source={getImageSource(category)}
                                        style={styles.image}
                                        resizeMode="cover"
                                    />
                                </View>
                                <Text style={styles.categoryName} numberOfLines={2}>
                                    {category.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 12,
    },
    loadingContainer: {
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    title: {
        fontWeight: '700',
        fontSize: 20,
        color: '#1A1A1A',
        letterSpacing: -0.5,
    },
    seeAll: {
        color: '#FF7D00',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 8,
    },
    column: {
        width: 80, // Fixed width for columns
        marginRight: 12,
        gap: 16, // Space between rows
    },
    cardContainer: {
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: 100, // Fixed height for consistent layout
    },
    imageWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32, // Circular
        backgroundColor: '#F0F0F0',
        overflow: 'hidden',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    categoryName: {
        fontSize: 11,
        color: '#333',
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 14,
    },
});
