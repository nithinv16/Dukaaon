/**
 * CategorySidebar - Sidebar component for category filtering in product screens
 * 
 * Implements Requirements:
 * - 4.1: Load category list with approximate counts within 200ms
 * - 4.3: Load subcategories with their counts when expanded
 * - 2.4: Cancel pending requests on category change
 * 
 * Features:
 * - Displays categories with product counts
 * - Supports subcategory expansion
 * - Handles category selection with request cancellation
 * - Shows loading skeleton while fetching
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface CategoryCount {
  category: string;
  subcategory: string | null;
  product_count: number;
}

export interface CategoryWithSubcategories {
  name: string;
  count: number;
  subcategories: Array<{
    name: string;
    count: number;
  }>;
}

export interface CategorySidebarProps {
  /** Aggregated categories with subcategories */
  categories: CategoryWithSubcategories[];
  /** Currently selected category (null for "All") */
  selectedCategory: string | null;
  /** Currently selected subcategory */
  selectedSubcategory: string | null;
  /** Currently expanded category */
  expandedCategory: string | null;
  /** Whether categories are loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Total product count across all categories */
  totalCount: number;
  /** Callback when category is selected */
  onCategorySelect: (category: string | null, subcategory: string | null) => void;
  /** Callback when category is expanded/collapsed */
  onCategoryExpand: (category: string | null) => void;
  /** Callback to retry loading on error */
  onRetry?: () => void;
}

/**
 * CategorySidebarSkeleton - Loading skeleton for category sidebar
 */
const CategorySidebarSkeleton: React.FC = () => {
  return (
    <View style={styles.skeletonContainer}>
      {/* All Categories skeleton */}
      <View style={styles.skeletonItem}>
        <View style={[styles.skeletonText, { width: '70%' }]} />
        <View style={[styles.skeletonBadge, { width: 30 }]} />
      </View>
      {/* Category skeletons */}
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonItem}>
          <View style={[styles.skeletonText, { width: `${50 + Math.random() * 30}%` }]} />
          <View style={[styles.skeletonBadge, { width: 25 }]} />
        </View>
      ))}
    </View>
  );
};

/**
 * CategorySidebar - Main component for category filtering
 */
const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  selectedCategory,
  selectedSubcategory,
  expandedCategory,
  isLoading,
  error,
  totalCount,
  onCategorySelect,
  onCategoryExpand,
  onRetry,
}) => {
  /**
   * Handle "All Categories" selection
   */
  const handleAllSelect = useCallback(() => {
    onCategorySelect(null, null);
  }, [onCategorySelect]);

  /**
   * Handle category selection
   * If category has subcategories and is not expanded, expand it
   * If category is already expanded or has no subcategories, select it
   */
  const handleCategoryPress = useCallback((category: CategoryWithSubcategories) => {
    if (category.subcategories.length > 0) {
      // Toggle expansion
      if (expandedCategory === category.name) {
        onCategoryExpand(null);
      } else {
        onCategoryExpand(category.name);
      }
    }
    // Select the category (clear subcategory)
    onCategorySelect(category.name, null);
  }, [expandedCategory, onCategoryExpand, onCategorySelect]);

  /**
   * Handle subcategory selection
   */
  const handleSubcategoryPress = useCallback((
    category: string,
    subcategory: string
  ) => {
    onCategorySelect(category, subcategory);
  }, [onCategorySelect]);

  /**
   * Check if a category is selected (either directly or via subcategory)
   */
  const isCategorySelected = useCallback((categoryName: string): boolean => {
    return selectedCategory === categoryName && selectedSubcategory === null;
  }, [selectedCategory, selectedSubcategory]);

  /**
   * Check if a subcategory is selected
   */
  const isSubcategorySelected = useCallback((
    categoryName: string,
    subcategoryName: string
  ): boolean => {
    return selectedCategory === categoryName && selectedSubcategory === subcategoryName;
  }, [selectedCategory, selectedSubcategory]);

  /**
   * Check if "All" is selected
   */
  const isAllSelected = useMemo(() => {
    return selectedCategory === null && selectedSubcategory === null;
  }, [selectedCategory, selectedSubcategory]);

  // Show loading skeleton
  if (isLoading && categories.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Categories</Text>
        <CategorySidebarSkeleton />
      </View>
    );
  }

  // Show error state
  if (error && categories.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Categories</Text>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={24} color="#E53935" />
          <Text style={styles.errorText}>{error}</Text>
          {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Categories</Text>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* All Categories option */}
        <TouchableOpacity
          style={[
            styles.categoryItem,
            isAllSelected && styles.categoryItemSelected,
          ]}
          onPress={handleAllSelect}
          activeOpacity={0.7}
        >
          <View style={styles.categoryContent}>
            <Ionicons 
              name="grid-outline" 
              size={18} 
              color={isAllSelected ? '#4CAF50' : '#666'} 
            />
            <Text style={[
              styles.categoryText,
              isAllSelected && styles.categoryTextSelected,
            ]}>
              All Products
            </Text>
          </View>
          <View style={[
            styles.countBadge,
            isAllSelected && styles.countBadgeSelected,
          ]}>
            <Text style={[
              styles.countText,
              isAllSelected && styles.countTextSelected,
            ]}>
              {totalCount}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Category list */}
        {categories.map((category) => {
          const isExpanded = expandedCategory === category.name;
          const isSelected = isCategorySelected(category.name);
          const hasSubcategories = category.subcategories.length > 0;

          return (
            <View key={category.name}>
              {/* Category item */}
              <TouchableOpacity
                style={[
                  styles.categoryItem,
                  isSelected && styles.categoryItemSelected,
                ]}
                onPress={() => handleCategoryPress(category)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryContent}>
                  {hasSubcategories && (
                    <Ionicons
                      name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                      size={16}
                      color={isSelected ? '#4CAF50' : '#999'}
                      style={styles.expandIcon}
                    />
                  )}
                  <Text style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextSelected,
                    !hasSubcategories && styles.categoryTextNoExpand,
                  ]}>
                    {category.name}
                  </Text>
                </View>
                <View style={[
                  styles.countBadge,
                  isSelected && styles.countBadgeSelected,
                ]}>
                  <Text style={[
                    styles.countText,
                    isSelected && styles.countTextSelected,
                  ]}>
                    {category.count}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Subcategories (when expanded) */}
              {isExpanded && hasSubcategories && (
                <View style={styles.subcategoryContainer}>
                  {category.subcategories.map((subcategory) => {
                    const isSubSelected = isSubcategorySelected(
                      category.name,
                      subcategory.name
                    );

                    return (
                      <TouchableOpacity
                        key={`${category.name}-${subcategory.name}`}
                        style={[
                          styles.subcategoryItem,
                          isSubSelected && styles.subcategoryItemSelected,
                        ]}
                        onPress={() => handleSubcategoryPress(
                          category.name,
                          subcategory.name
                        )}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.subcategoryText,
                          isSubSelected && styles.subcategoryTextSelected,
                        ]}>
                          {subcategory.name}
                        </Text>
                        <View style={[
                          styles.subcountBadge,
                          isSubSelected && styles.subcountBadgeSelected,
                        ]}>
                          <Text style={[
                            styles.subcountText,
                            isSubSelected && styles.subcountTextSelected,
                          ]}>
                            {subcategory.count}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* Loading indicator for background refresh */}
        {isLoading && categories.length > 0 && (
          <View style={styles.refreshIndicator}>
            <ActivityIndicator size="small" color="#4CAF50" />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    paddingVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  categoryItemSelected: {
    backgroundColor: '#E8F5E9',
    borderLeftColor: '#4CAF50',
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expandIcon: {
    marginRight: 4,
  },
  categoryText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  categoryTextSelected: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  categoryTextNoExpand: {
    marginLeft: 20,
  },
  countBadge: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
  },
  countBadgeSelected: {
    backgroundColor: '#4CAF50',
  },
  countText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  countTextSelected: {
    color: '#fff',
  },
  subcategoryContainer: {
    backgroundColor: '#fafafa',
    borderLeftWidth: 3,
    borderLeftColor: '#e0e0e0',
    marginLeft: 12,
  },
  subcategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingLeft: 24,
  },
  subcategoryItemSelected: {
    backgroundColor: '#E8F5E9',
  },
  subcategoryText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  subcategoryTextSelected: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  subcountBadge: {
    backgroundColor: '#e8e8e8',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 24,
    alignItems: 'center',
  },
  subcountBadgeSelected: {
    backgroundColor: '#81C784',
  },
  subcountText: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  subcountTextSelected: {
    color: '#fff',
  },
  skeletonContainer: {
    paddingHorizontal: 12,
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  skeletonText: {
    height: 14,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  skeletonBadge: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  refreshIndicator: {
    padding: 12,
    alignItems: 'center',
  },
});

export default CategorySidebar;
