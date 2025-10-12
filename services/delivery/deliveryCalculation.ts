// Dynamic delivery fee calculation service
import * as Location from 'expo-location';

// Debug flag - set to false to disable logs
const DEBUG_LOGS = false;

// Force debug on for critical coordinate checks only
const COORDINATE_DEBUG = true;

// Log cache to prevent duplicate logs
const logCache: Record<string, boolean> = {};

// Helper for logging only once
const logWarningOnce = (message: string, data?: any) => {
  if (!DEBUG_LOGS) return;
  
  const key = message + JSON.stringify(data || {});
  if (!logCache[key]) {
    console.warn(message, data || '');
    logCache[key] = true;
  }
};

const logErrorOnce = (message: string, error?: any) => {
  if (!DEBUG_LOGS) return;
  
  const key = message + (error ? JSON.stringify(error) : '');
  if (!logCache[key]) {
    console.error(message, error || '');
    logCache[key] = true;
  }
};

// For debugging coordinates specifically
const logCoords = (message: string, data?: any) => {
  if (COORDINATE_DEBUG) {
    console.log(`[COORDS_CALC] ${message}`, data || '');
  }
};

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  try {
    // Log the input coordinates
    logCoords(`Distance calculation input: (${lat1},${lon1}) → (${lat2},${lon2})`);
    
    // Validate inputs to prevent NaN errors
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
      logCoords('⚠️ Invalid coordinates (NaN) in calculateDistance', { lat1, lon1, lat2, lon2 });
      return 0;
    }
    
    // If any coordinate is 0, check if they're all 0 (likely default values)
    if ((lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)) {
      logCoords('⚠️ Default coordinates (0,0) detected in calculateDistance');
      return 0;
    }
    
    const R = 6371; // Radius of the Earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    
    // Validate output to prevent NaN or Infinity
    if (isNaN(distance) || !isFinite(distance)) {
      logCoords('⚠️ Invalid distance calculation result', { distance, lat1, lon1, lat2, lon2 });
      return 0;
    }
    
    logCoords(`Distance calculation result: ${distance.toFixed(2)}km`);
    return distance;
  } catch (error) {
    logCoords('⚠️ Error in calculateDistance:', error);
    return 0; // Return 0 as fallback
  }
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculates the delivery fee based on distance and order value
 * @param distance Distance in kilometers (one-way)
 * @param orderValue Total order value in rupees
 * @returns Object containing fee and vehicle type
 */
export function calculateDeliveryFee(distance: number, orderValue: number) {
  try {
    // Validate inputs
    if (isNaN(distance) || isNaN(orderValue)) {
      logWarningOnce('Invalid inputs to calculateDeliveryFee', { distance, orderValue });
      
      // Get default values based on order value
      let defaultFee = 20;
      let vehicleType = '2-wheeler';
      
      if (orderValue > 15000) {
        defaultFee = 50;
        vehicleType = '4-wheeler';
      } else if (orderValue > 5000) {
        defaultFee = 40;
        vehicleType = '3-wheeler';
      }
      
      return { 
        fee: defaultFee, 
        vehicleType: vehicleType, 
        maxPercentage: '0%' 
      };
    }
    
    // Ensure distance and orderValue are non-negative
    distance = Math.max(0, distance);
    orderValue = Math.max(0, orderValue);
    
    let baseFee = 0;
    let extraKmRate = 0;
    let vehicleType = '';

    // Determine vehicle type based on order value
    if (orderValue <= 5000) {
      vehicleType = '2-wheeler';
      baseFee = 20; // ₹20 for 0-2km
      
      // Determine rate for extra kilometers
      if (orderValue >= 1000 && orderValue <= 1300) {
        extraKmRate = 8; // ₹8 per km for orders between ₹1000-₹1300
      } else {
        extraKmRate = 10; // ₹10 per km for other orders
      }
    } else if (orderValue <= 15000) {
      vehicleType = '3-wheeler';
      baseFee = 40; // ₹40 for 0-2km
      
      // Determine rate for extra kilometers
      if (orderValue > 4000) {
        extraKmRate = 20; // ₹20 per km for orders above ₹4000
      } else {
        extraKmRate = 15; // ₹15 per km for other orders
      }
    } else {
      vehicleType = '4-wheeler';
      baseFee = 50; // ₹50 for 0-2km
      
      // Determine rate for extra kilometers
      if (orderValue > 8000) {
        extraKmRate = 30; // ₹30 per km for orders above ₹8000
      } else {
        extraKmRate = 20; // ₹20 per km for other orders
      }
    }

    // Calculate fee based on distance
    let fee = baseFee; // Start with base fee
    
    // Add extra km charges for distances beyond 2km
    if (distance > 2) {
      const extraDistance = distance - 2;
      fee += extraDistance * extraKmRate;
    }
    
    // Round to nearest integer
    fee = Math.round(fee);
    
    // Ensure fee is never negative or zero
    fee = Math.max(baseFee, fee);
    
    // Log the calculation (only if debugging and only first time for this order value/distance combo)
    if (DEBUG_LOGS) {
      const calculationKey = `${Math.round(distance)}-${Math.round(orderValue/100)}`;
      if (!logCache[calculationKey]) {
        logCache[calculationKey] = true;
        console.log('Delivery fee calculation:', { 
          distance, 
          orderValue, 
          vehicleType, 
          baseFee, 
          extraKmRate, 
          finalFee: fee 
        });
      }
    }
    
    // Get percentage for reporting purposes
    const percentageOfOrder = orderValue > 0 ? ((fee / orderValue) * 100).toFixed(1) + '%' : '0%';
    
    return {
      fee: fee,
      vehicleType: vehicleType,
      maxPercentage: percentageOfOrder
    };
  } catch (error) {
    logErrorOnce('Error in calculateDeliveryFee:', error);
    
    // Get default values based on order value
    let defaultFee = 20;
    let vehicleType = '2-wheeler';
    
    if (orderValue > 15000) {
      defaultFee = 50;
      vehicleType = '4-wheeler';
    } else if (orderValue > 5000) {
      defaultFee = 40;
      vehicleType = '3-wheeler';
    }
    
    return { 
      fee: defaultFee, 
      vehicleType: vehicleType, 
      maxPercentage: '0%' 
    };
  }
}

/**
 * Estimates delivery fee based on seller and buyer locations
 * @param sellerLocation Seller's coordinates
 * @param buyerLocation Buyer's coordinates
 * @param orderValue Order value in rupees
 * @returns Delivery fee details
 */
export async function estimateDeliveryFee(
  sellerLocation: {latitude: number, longitude: number}, 
  buyerLocation: {latitude: number, longitude: number},
  orderValue: number
) {
  try {
    // Validate inputs
    if (!sellerLocation || !buyerLocation || 
        sellerLocation.latitude === undefined || sellerLocation.longitude === undefined ||
        buyerLocation.latitude === undefined || buyerLocation.longitude === undefined) {
      logWarningOnce('Invalid location data in estimateDeliveryFee');
      return { 
        fee: 20, 
        vehicleType: '2-wheeler', 
        maxPercentage: '0%', 
        distance: 0,
        unit: 'km'
      };
    }
    
    // Calculate distance between seller and buyer
    const distance = calculateDistance(
      sellerLocation.latitude,
      sellerLocation.longitude,
      buyerLocation.latitude,
      buyerLocation.longitude
    );
    
    // Calculate fee based on distance and order value
    return {
      ...calculateDeliveryFee(distance, orderValue),
      distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
      unit: 'km'
    };
  } catch (error) {
    logErrorOnce('Error in estimateDeliveryFee:', error);
    return { 
      fee: 20, 
      vehicleType: '2-wheeler', 
      maxPercentage: '0%', 
      distance: 0,
      unit: 'km'
    };
  }
}

/**
 * Calculates different delivery fees for several example scenarios
 * Useful for testing and demonstration
 */
export function getDeliveryFeeExamples() {
  const scenarios = [
    { distance: 2, orderValue: 1000, description: "Short distance, small order" },
    { distance: 5, orderValue: 1000, description: "Medium distance, small order" },
    { distance: 10, orderValue: 1000, description: "Long distance, small order" },
    { distance: 10, orderValue: 3000, description: "Long distance, medium order" },
    { distance: 10, orderValue: 8000, description: "Long distance, large order" },
    { distance: 10, orderValue: 20000, description: "Long distance, very large order" },
    { distance: 15, orderValue: 10000, description: "Very long distance, large order" },
  ];
  
  return scenarios.map(scenario => ({
    ...scenario,
    ...calculateDeliveryFee(scenario.distance, scenario.orderValue)
  }));
} 