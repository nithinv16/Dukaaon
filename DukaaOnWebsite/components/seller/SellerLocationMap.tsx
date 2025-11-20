'use client';

import { useEffect, useRef, useState } from 'react';
import { Seller } from '@/types';
import { Card } from '@/components/ui/Card';
import { MapPin, Navigation } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGeolocation } from '@/hooks/useGeolocation';
import { calculateDistance } from '@/lib/geolocation';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface SellerLocationMapProps {
  seller: Seller;
}

export function SellerLocationMap({ seller }: SellerLocationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState<number | null>(null);
  
  const { coordinates: userLocation } = useGeolocation();

  // Calculate distance from user to seller
  useEffect(() => {
    if (userLocation) {
      const dist = calculateDistance(
        userLocation,
        seller.location.coordinates
      );
      setDistance(dist);
    }
  }, [userLocation, seller.location.coordinates]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map centered on seller location
    const map = L.map(mapContainerRef.current).setView(
      [seller.location.coordinates.latitude, seller.location.coordinates.longitude],
      13
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
  }, [seller.location.coordinates]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        layer.remove();
      }
    });

    // Add seller marker
    const sellerIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center w-12 h-12 bg-primary-orange rounded-full border-4 border-white shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
      className: 'seller-location-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    L.marker(
      [seller.location.coordinates.latitude, seller.location.coordinates.longitude],
      { icon: sellerIcon }
    )
      .addTo(mapRef.current)
      .bindPopup(
        `
        <div class="p-2">
          <h3 class="font-bold text-base mb-1">${seller.businessName}</h3>
          <p class="text-sm text-gray-600">
            ${seller.location.city}, ${seller.location.state}
          </p>
        </div>
      `,
        { closeButton: false }
      )
      .openPopup();

    // Add user location marker if available
    if (userLocation) {
      const userIcon = L.divIcon({
        html: `
          <div class="flex items-center justify-center w-10 h-10 bg-blue-500 rounded-full border-4 border-white shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
        `,
        className: 'user-location-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      L.marker([userLocation.latitude, userLocation.longitude], {
        icon: userIcon,
      })
        .addTo(mapRef.current)
        .bindPopup('<strong>Your Location</strong>');

      // Draw a line between user and seller
      L.polyline(
        [
          [userLocation.latitude, userLocation.longitude],
          [seller.location.coordinates.latitude, seller.location.coordinates.longitude],
        ],
        {
          color: '#FF6B35',
          weight: 2,
          opacity: 0.6,
          dashArray: '10, 10',
        }
      ).addTo(mapRef.current);

      // Fit bounds to show both markers
      const bounds = L.latLngBounds([
        [userLocation.latitude, userLocation.longitude] as L.LatLngTuple,
        [
          seller.location.coordinates.latitude,
          seller.location.coordinates.longitude,
        ] as L.LatLngTuple,
      ]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [seller, userLocation]);

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-heading font-bold text-primary-dark mb-2">
          Location
        </h2>
        <div className="space-y-2">
          <div className="flex items-start text-primary-gray">
            <MapPin className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-primary-dark">
                {seller.location.city}, {seller.location.state}
              </p>
              {distance !== null && (
                <div className="flex items-center mt-1 text-sm">
                  <Navigation className="w-4 h-4 mr-1 text-primary-orange" />
                  <span>
                    Approximately <span className="font-semibold">{distance.toFixed(1)} km</span> from your location
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div
        ref={mapContainerRef}
        className="w-full h-[400px] rounded-lg overflow-hidden shadow-md"
      />

      {/* Map Instructions */}
      <p className="text-sm text-primary-gray mt-4 text-center">
        Click and drag to explore the map. Zoom in/out using the controls or scroll wheel.
      </p>
    </Card>
  );
}
