/**
 * Data Services - Unified data fetching with caching
 * 
 * This module exports all data fetching services that implement
 * cache-first strategies with background refresh for the DataFetchCoordinator.
 */

export { ProductsDataService, ProductsDataServiceClass } from './ProductsDataService';
export type { ProductsFetchOptions, ProductsFetchResult } from './ProductsDataService';

export { CategoriesDataService, CategoriesDataServiceClass } from './CategoriesDataService';
export type { Category, CategoriesFetchOptions, CategoriesFetchResult } from './CategoriesDataService';

export { SellersDataService, SellersDataServiceClass } from './SellersDataService';
export type { Seller, SellersFetchOptions, SellersFetchResult } from './SellersDataService';

export { DataFetchCoordinator, DataFetchCoordinatorClass } from './DataFetchCoordinator';
export type { 
  DataFetchCoordinatorConfig, 
  DataFetchResult 
} from './DataFetchCoordinator';
