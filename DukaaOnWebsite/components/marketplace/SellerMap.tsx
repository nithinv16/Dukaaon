'use client';

import { useEffect, useRef } from 'react';
import { Seller, Coordinates } from '@/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface SellerMapProps {
  sellers: Seller[];
  userLocation: Coordinates;
  onSellerClick: (sellerId: string) => void;
  radius: number;
  className?: string;
}

export function SellerMap({
  sellers,
  userLocation,
  onSellerClick,
  radius,
  className = '',
}: SellerMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current).setView(
      [userLocation.latitude, userLocation.longitude],
      10
    );

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [userLocation]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Clear existing circle
    if (circleRef.current) {
      circleRef.current.remove();
    }

    // Add user location marker
    const userIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
      `,
      className: 'user-location-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([userLocation.latitude, userLocation.longitude], {
      icon: userIcon,
    })
      .addTo(mapRef.current)
      .bindPopup('<strong>Your Location</strong>');

    // Add radius circle
    circleRef.current = L.circle(
      [userLocation.latitude, userLocation.longitude],
      {
        radius: radius * 1000, // Convert km to meters
        color: '#FF6B35',
        fillColor: '#FF6B35',
        fillOpacity: 0.1,
        weight: 2,
      }
    ).addTo(mapRef.current);

    // Add seller markers
    sellers.forEach((seller) => {
      const sellerIcon = L.divIcon({
        html: `
          <div class="flex items-center justify-center w-10 h-10 bg-primary-orange rounded-full border-3 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
              <path d="M9 22v-4h6v4"/>
              <path d="M8 6h.01"/>
              <path d="M16 6h.01"/>
              <path d="M12 6h.01"/>
              <path d="M12 10h.01"/>
              <path d="M12 14h.01"/>
              <path d="M16 10h.01"/>
              <path d="M16 14h.01"/>
              <path d="M8 10h.01"/>
              <path d="M8 14h.01"/>
            </svg>
          </div>
        `,
        className: 'seller-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker(
        [seller.location.coordinates.latitude, seller.location.coordinates.longitude],
        { icon: sellerIcon }
      )
        .addTo(mapRef.current!)
        .bindPopup(
          `
          <div class="p-2 min-w-[200px]">
            <h3 class="font-bold text-base mb-1">${seller.businessName}</h3>
            <p class="text-sm text-gray-600 mb-1">
              <span class="inline-block px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-semibold uppercase">
                ${seller.businessType}
              </span>
            </p>
            <p class="text-sm text-gray-600 mb-2">
              ${seller.location.city}, ${seller.location.state}
            </p>
            ${
              seller.distance
                ? `<p class="text-xs text-gray-500 mb-2">📍 ${seller.distance.toFixed(1)} km away</p>`
                : ''
            }
            <button 
              onclick="window.dispatchEvent(new CustomEvent('seller-click', { detail: '${seller.id}' }))"
              class="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2 px-3 rounded transition-colors"
            >
              View Details
            </button>
          </div>
        `,
          { maxWidth: 250 }
        );

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (sellers.length > 0) {
      const bounds = L.latLngBounds([
        [userLocation.latitude, userLocation.longitude] as L.LatLngTuple,
        ...sellers.map((s) => [
          s.location.coordinates.latitude,
          s.location.coordinates.longitude,
        ] as L.LatLngTuple),
      ]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [sellers, userLocation, radius]);

  // Handle seller click events from popup
  useEffect(() => {
    const handleSellerClick = (event: Event) => {
      const customEvent = event as CustomEvent;
      onSellerClick(customEvent.detail);
    };

    window.addEventListener('seller-click', handleSellerClick);
    return () => window.removeEventListener('seller-click', handleSellerClick);
  }, [onSellerClick]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden shadow-md"
        style={{ minHeight: '400px' }}
      />
      {sellers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="text-center p-6">
            <MapPin className="w-12 h-12 text-primary-gray mx-auto mb-3" />
            <p className="text-primary-gray">No sellers to display on map</p>
          </div>
        </div>
      )}
    </div>
  );
}
