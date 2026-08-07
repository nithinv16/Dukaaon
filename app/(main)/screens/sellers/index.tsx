import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { Card, Button, Chip, Searchbar, Menu, Divider } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useLocationStore } from '../../../../store/location';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';
import { useInstantTranslation } from '../../../../hooks/useInstantTranslation';
import { Ionicons } from '@expo/vector-icons';

// Original texts for translation
const ORIGINAL_TEXTS = {
  exploreSellers: 'Explore Sellers',
  searchPlaceholder: 'Search sellers, tags...',
  loadingSellers: 'Loading sellers...',
  all: 'All',
  wholesalers: 'Wholesalers',
  manufacturers: 'Manufacturers',
  wholesaler: 'Wholesaler',
  manufacturer: 'Manufacturer',
  result: 'result',
  results: 'results',
  details: 'Details',
  viewProducts: 'View Products',
  noSellersFound: 'No sellers found',
  tryAdjustingFilters: 'Try adjusting your filters',
  addressNotAvailable: 'Address not available',
  owner: 'Owner',
  type: 'Type',
  distance: 'Distance',
  kmAway: 'km away',
  description: 'Description',
  tags: 'Tags',
  address: 'Address',
  close: 'Close',
};

interface Seller {
  id: string;
  user_id: string;
  business_name: string;
  owner_name?: string;
  seller_type: 'wholesaler' | 'manufacturer';
  address?: any;
  latitude?: number;
  longitude?: number;
  image_url?: string;
  description?: string;
  tags?: string[];
  distance?: number;
}

export default function SellersListing() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { userLocation } = useLocationStore();
  const { currentLanguage } = useLanguage();
  const { t } = useInstantTranslation(ORIGINAL_TEXTS);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [filteredSellers, setFilteredSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'wholesaler' | 'manufacturer' | 'all'>(
    params.type === 'wholesaler' ? 'wholesaler' : params.type === 'manufacturer' ? 'manufacturer' : 'all'
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);

  // Calculate distance using Haversine formula
  const haversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // km
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  // Fetch all sellers
  const fetchSellers = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('seller_details')
        .select('*');

      // Filter by seller type if specified
      if (selectedType !== 'all') {
        query = query.eq('seller_type', selectedType);
      }

      // Don't filter by status - let RLS handle it, similar to NearbyWholesalers/Manufacturers
      // The RLS policy filters by business_name IS NOT NULL, which effectively shows active sellers

      const { data, error } = await query;

      console.log('Fetched sellers:', data?.length || 0, 'error:', error);

      if (error) {
        console.error('Query error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      }

      if (error) {
        console.error('Error fetching sellers:', error);
        setSellers([]);
        return;
      }

      // Calculate distances if user location is available
      let sellersWithDistance = (data || []).map((seller: any) => {
        let distance = undefined;
        if (userLocation && seller.latitude && seller.longitude) {
          distance = haversineDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            Number(seller.latitude),
            Number(seller.longitude)
          );
        }
        return { ...seller, distance };
      });

      // Sort by distance if available, otherwise by name
      sellersWithDistance.sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        if (a.distance !== undefined) return -1;
        if (b.distance !== undefined) return 1;
        return (a.business_name || '').localeCompare(b.business_name || '');
      });

      setSellers(sellersWithDistance);

      // Extract all unique tags
      const allTags = new Set<string>();
      sellersWithDistance.forEach((seller) => {
        if (seller.tags && Array.isArray(seller.tags)) {
          seller.tags.forEach((tag: string) => allTags.add(tag));
        }
      });
      setAvailableTags(Array.from(allTags).sort());
    } catch (error) {
      console.error('Error fetching sellers:', error);
      setSellers([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, userLocation]);

  // Apply filters
  useEffect(() => {
    let filtered = [...sellers];

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter((seller) => {
        if (!seller.tags || !Array.isArray(seller.tags)) return false;
        return selectedTags.some((tag) => seller.tags?.includes(tag));
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (seller) =>
          seller.business_name?.toLowerCase().includes(query) ||
          seller.owner_name?.toLowerCase().includes(query) ||
          seller.description?.toLowerCase().includes(query) ||
          seller.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    setFilteredSellers(filtered);
  }, [sellers, selectedTags, searchQuery]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const formatAddress = (address: any): string => {
    if (!address) return t.addressNotAvailable;
    if (typeof address === 'string') return address;
    if (typeof address === 'object') {
      const parts = [];
      if (address.street) parts.push(address.street);
      if (address.city) parts.push(address.city);
      if (address.state) parts.push(address.state);
      if (address.pincode) parts.push(address.pincode);
      return parts.length > 0 ? parts.join(', ') : t.addressNotAvailable;
    }
    return t.addressNotAvailable;
  };

  const handleViewProducts = (sellerId: string) => {
    router.push(`/(main)/screens/category/${sellerId}`);
  };

  const handleViewDetails = (seller: Seller) => {
    setSelectedSeller(seller);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7D00" />
        <Text style={styles.loadingText}>{t.loadingSellers}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with filters */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>{t.exploreSellers}</Text>
        </View>
        <Searchbar
          placeholder={t.searchPlaceholder}
          placeholderTextColor="#999"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor="#FF7D00"
          elevation={0}
        />

        {/* Filters ScrollView */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {/* Type Filters */}
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'all' && styles.filterChipSelected]}
            onPress={() => setSelectedType('all')}
          >
            <Text style={[styles.filterText, selectedType === 'all' && styles.filterTextSelected]}>{t.all}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'wholesaler' && styles.filterChipSelected]}
            onPress={() => setSelectedType('wholesaler')}
          >
            <Text style={[styles.filterText, selectedType === 'wholesaler' && styles.filterTextSelected]}>{t.wholesalers}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'manufacturer' && styles.filterChipSelected]}
            onPress={() => setSelectedType('manufacturer')}
          >
            <Text style={[styles.filterText, selectedType === 'manufacturer' && styles.filterTextSelected]}>{t.manufacturers}</Text>
          </TouchableOpacity>

          {/* Separator */}
          {availableTags.length > 0 && <View style={styles.filterSeparator} />}

          {/* Tag Filters */}
          {availableTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.filterChip, selectedTags.includes(tag) && styles.filterChipSelected]}
              onPress={() => toggleTag(tag)}
            >
              <Text style={[styles.filterText, selectedTags.includes(tag) && styles.filterTextSelected]}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Results count */}
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsCount}>
            {filteredSellers.length} {filteredSellers.length !== 1 ? t.results : t.result}
          </Text>
        </View>
      </View>

      {/* Sellers list */}
      <FlatList
        data={filteredSellers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.sellerCardWrapper}>
            <TouchableOpacity
              style={styles.sellerCard}
              onPress={() => handleViewDetails(item)}
              activeOpacity={0.9}
            >
              <View style={styles.cardContent}>
                <View style={styles.sellerHeader}>
                  <View style={styles.imageContainer}>
                    {item.image_url ? (
                      <Card.Cover source={{ uri: item.image_url }} style={styles.sellerImage} />
                    ) : (
                      <View style={styles.placeholderImage}>
                        <Text style={styles.placeholderText}>{item.business_name?.substring(0, 1) || 'B'}</Text>
                      </View>
                    )}
                    {item.distance !== undefined && (
                      <View style={styles.distanceBadge}>
                        <Ionicons name="location-sharp" size={10} color="#fff" />
                        <Text style={styles.distanceText}>{item.distance.toFixed(1)} km</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.sellerInfo}>
                    <View style={styles.titleRow}>
                      <Text style={styles.businessName} numberOfLines={1}>{item.business_name || 'Business'}</Text>
                      {item.seller_type === 'wholesaler' ? (
                        <View style={[styles.typeBadge, styles.badgeWholesaler]}>
                          <Text style={styles.typeBadgeText}>{t.wholesaler}</Text>
                        </View>
                      ) : (
                        <View style={[styles.typeBadge, styles.badgeManufacturer]}>
                          <Text style={styles.typeBadgeText}>{t.manufacturer}</Text>
                        </View>
                      )}
                    </View>

                    {item.owner_name && (
                      <Text style={styles.ownerName} numberOfLines={1}>{item.owner_name}</Text>
                    )}

                    <Text style={styles.address} numberOfLines={1}>
                      {formatAddress(item.address)}
                    </Text>

                    {item.tags && item.tags.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsRow}>
                        {item.tags.slice(0, 3).map((tag, index) => (
                          <Text key={index} style={styles.miniTag}>#{tag}</Text>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                </View>

                {item.description && (
                  <Text style={styles.description} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}

                <Divider style={styles.cardDivider} />

                <View style={styles.actions}>
                  <Button
                    mode="text"
                    onPress={() => handleViewDetails(item)}
                    style={styles.actionButtonSecondary}
                    labelStyle={styles.actionLabelSecondary}
                  >
                    {t.details}
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => handleViewProducts(item.user_id)}
                    style={styles.actionButtonPrimary}
                    labelStyle={styles.actionLabelPrimary}
                    icon="arrow-right"
                    contentStyle={{ flexDirection: 'row-reverse' }}
                  >
                    {t.viewProducts}
                  </Button>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t.noSellersFound}</Text>
            <Text style={styles.emptySubtext}>{t.tryAdjustingFilters}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />

      {/* Seller details modal */}
      {selectedSeller && (
        <View style={styles.modalOverlay}>
          <Card style={styles.detailsModal}>
            <Card.Content>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedSeller.business_name}</Text>
                <TouchableOpacity onPress={() => setSelectedSeller(null)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalContent}
                contentContainerStyle={styles.modalContentContainer}
              >
                {selectedSeller.image_url && (
                  <Card.Cover source={{ uri: selectedSeller.image_url }} style={styles.modalImage} />
                )}

                {selectedSeller.owner_name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t.owner}:</Text>
                    <Text style={styles.detailValue}>{selectedSeller.owner_name}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t.type}:</Text>
                  <Text style={styles.detailValue}>
                    {selectedSeller.seller_type === 'wholesaler' ? t.wholesaler : t.manufacturer}
                  </Text>
                </View>

                {selectedSeller.distance !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t.distance}:</Text>
                    <Text style={styles.detailValue}>{selectedSeller.distance.toFixed(1)} {t.kmAway}</Text>
                  </View>
                )}

                {selectedSeller.description && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t.description}:</Text>
                    <Text style={styles.detailValue}>{selectedSeller.description}</Text>
                  </View>
                )}

                {selectedSeller.tags && selectedSeller.tags.length > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t.tags}:</Text>
                    <View style={styles.modalTags}>
                      {selectedSeller.tags.map((tag, index) => (
                        <Chip key={index} mode="outlined" style={styles.tagChip}>
                          {tag}
                        </Chip>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t.address}:</Text>
                  <Text style={styles.detailValue}>{formatAddress(selectedSeller.address)}</Text>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <Button
                  mode="contained"
                  onPress={() => {
                    setSelectedSeller(null);
                    handleViewProducts(selectedSeller.user_id);
                  }}
                  style={styles.modalButton}
                  buttonColor="#FF7D00"
                >
                  {t.viewProducts}
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setSelectedSeller(null)}
                  style={styles.modalButton}
                  textColor="#FF7D00"
                >
                  {t.close}
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontWeight: '500',
  },
  // Header Styles
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#FF7D00', // Subtle orange glow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 4,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  searchbar: {
    backgroundColor: '#FAFAFA',
    elevation: 0,
    borderRadius: 16,
    marginBottom: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  searchInput: {
    minHeight: 0,
    fontSize: 15,
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  filterSeparator: {
    width: 1,
    height: 20,
    backgroundColor: '#eee',
    marginHorizontal: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipSelected: {
    backgroundColor: '#FF7D00', // Brand Orange
    borderColor: '#FF7D00',
    elevation: 2,
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#757575',
  },
  filterTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  resultsCount: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // List Styles
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 100,
  },

  // Card Styles
  sellerCardWrapper: {
    marginBottom: 20,
  },
  sellerCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  sellerHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  sellerImage: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  placeholderImage: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FF7D00',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 26, 0.8)', // Darker semitransparent
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  distanceText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  sellerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  businessName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.3,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeWholesaler: {
    backgroundColor: '#FFF8E1', // Very light orange
    borderColor: '#FFD54F',
  },
  badgeManufacturer: {
    backgroundColor: '#F3E5F5', // Very light purple
    borderColor: '#CE93D8',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333',
    textTransform: 'uppercase',
  },
  ownerName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  address: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  miniTag: {
    fontSize: 11,
    color: '#FF7D00',
    marginRight: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  cardDivider: {
    backgroundColor: '#F5F5F5',
    marginBottom: 16,
    height: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButtonSecondary: {
    borderRadius: 14,
    minWidth: 90,
    borderColor: '#E0E0E0',
    borderWidth: 1,
  },
  actionLabelSecondary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#757575',
  },
  actionButtonPrimary: {
    borderRadius: 14,
    backgroundColor: '#FF7D00', // Brand Orange
    flex: 1,
    elevation: 2,
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  actionLabelPrimary: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Empty & Modal Styles preserved and updated
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', // Darker overlay
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  detailsModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    flex: 1,
    letterSpacing: -0.5,
  },
  modalContent: {
    maxHeight: 500,
  },
  modalContentContainer: {
    padding: 24,
    paddingTop: 8,
  },
  modalImage: {
    height: 220,
    marginBottom: 24,
    borderRadius: 16,
    marginTop: 16,
  },
  detailRow: {
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f5f5f5',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9E9E9E',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
    fontWeight: '500',
  },
  modalTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
  },
  tagChip: {
    backgroundColor: '#fff',
    borderColor: '#E0E0E0',
  },
});
