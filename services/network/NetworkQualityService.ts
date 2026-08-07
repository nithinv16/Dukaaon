/**
 * NetworkQualityService - Network quality detection and adaptive batch sizing
 * 
 * Implements Requirements 2.5:
 * - Detect slow network connections (2G/3G)
 * - Reduce initial product batch size for slow networks
 * - Support infinite scroll pagination
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

export type NetworkQuality = 'fast' | 'slow' | 'offline';

export interface NetworkState {
  quality: NetworkQuality;
  type: string;
  isConnected: boolean;
  cellularGeneration?: string;
}

export interface BatchSizeConfig {
  fast: number;
  slow: number;
  offline: number;
}

// Default batch sizes per network quality
const DEFAULT_BATCH_SIZES: BatchSizeConfig = {
  fast: 50,
  slow: 10, // Reduced to 10 for slow networks as per Requirements 2.5
  offline: 0,
};

type NetworkQualityCallback = (state: NetworkState) => void;

class NetworkQualityServiceClass {
  private currentState: NetworkState = {
    quality: 'fast',
    type: 'unknown',
    isConnected: true,
  };
  private listeners: Set<NetworkQualityCallback> = new Set();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.initializeListener();
  }

  /**
   * Initialize network state listener
   */
  private initializeListener(): void {
    this.unsubscribe = NetInfo.addEventListener(this.handleNetworkChange.bind(this));
    
    // Get initial state
    NetInfo.fetch().then(this.handleNetworkChange.bind(this));
  }

  /**
   * Handle network state changes
   */
  private handleNetworkChange(state: NetInfoState): void {
    const quality = this.determineQuality(state);
    const details = state.details as any;
    
    this.currentState = {
      quality,
      type: state.type,
      isConnected: state.isConnected ?? false,
      cellularGeneration: details?.cellularGeneration,
    };

    // Notify all listeners
    this.listeners.forEach(callback => callback(this.currentState));
  }

  /**
   * Determine network quality from NetInfo state
   */
  private determineQuality(state: NetInfoState): NetworkQuality {
    if (!state.isConnected) {
      return 'offline';
    }

    // Check for cellular connection
    if (state.type === 'cellular') {
      const details = state.details as any;
      const generation = details?.cellularGeneration;
      
      // 2G and 3G are considered slow
      if (generation === '2g' || generation === '3g') {
        return 'slow';
      }
    }

    // Check for slow wifi or other indicators
    if (state.type === 'wifi') {
      const details = state.details as any;
      // If we have signal strength info and it's weak, consider it slow
      if (details?.strength !== undefined && details.strength < 30) {
        return 'slow';
      }
    }

    return 'fast';
  }

  /**
   * Get current network quality
   */
  getQuality(): NetworkQuality {
    return this.currentState.quality;
  }

  /**
   * Get current network state
   */
  getState(): NetworkState {
    return { ...this.currentState };
  }

  /**
   * Get recommended batch size based on current network quality
   */
  getBatchSize(customConfig?: Partial<BatchSizeConfig>): number {
    const config = { ...DEFAULT_BATCH_SIZES, ...customConfig };
    return config[this.currentState.quality];
  }

  /**
   * Check if network is slow (2G/3G)
   */
  isSlowNetwork(): boolean {
    return this.currentState.quality === 'slow';
  }

  /**
   * Check if device is offline
   */
  isOffline(): boolean {
    return this.currentState.quality === 'offline';
  }

  /**
   * Subscribe to network quality changes
   */
  subscribe(callback: NetworkQualityCallback): () => void {
    this.listeners.add(callback);
    
    // Immediately call with current state
    callback(this.currentState);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const NetworkQualityService = new NetworkQualityServiceClass();

// Export class for testing
export { NetworkQualityServiceClass };
