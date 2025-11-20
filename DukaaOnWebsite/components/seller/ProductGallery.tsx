'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, ChevronRight, X, Package, Loader2 } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  image_url?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  description?: string;
}

interface ProductGalleryProps {
  sellerId: string;
}

export function ProductGallery({ sellerId }: ProductGalleryProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [carouselStartIndex, setCarouselStartIndex] = useState(0);

  const imagesPerPage = 4;

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);

        // Fetch products from API route
        const response = await fetch(`/api/products?seller_id=${sellerId}`);
        const result = await response.json();

        if (response.ok && result.success) {
          setProducts(result.data);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [sellerId]);

  const productsWithImages = products.filter((p) => p.image_url);

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === productsWithImages.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? productsWithImages.length - 1 : prev - 1
    );
  };

  const nextCarousel = () => {
    if (carouselStartIndex + imagesPerPage < productsWithImages.length) {
      setCarouselStartIndex(carouselStartIndex + imagesPerPage);
    }
  };

  const prevCarousel = () => {
    if (carouselStartIndex > 0) {
      setCarouselStartIndex(Math.max(0, carouselStartIndex - imagesPerPage));
    }
  };

  const visibleProducts = productsWithImages.slice(
    carouselStartIndex,
    carouselStartIndex + imagesPerPage
  );

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary-orange animate-spin" />
        </div>
      </Card>
    );
  }

  if (productsWithImages.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Package className="w-12 h-12 text-primary-gray/30 mx-auto mb-3" />
          <h3 className="text-lg font-heading font-semibold text-primary-dark mb-1">
            No Product Images
          </h3>
          <p className="text-primary-gray text-sm">
            This seller hasn&apos;t uploaded product images yet.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-heading font-bold text-primary-dark mb-2">
            Product Gallery
          </h2>
          <p className="text-primary-gray">
            Browse through our product collection. Contact us for pricing and availability.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Navigation Buttons */}
          {productsWithImages.length > imagesPerPage && (
            <>
              <button
                onClick={prevCarousel}
                disabled={carouselStartIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-neutral-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous products"
              >
                <ChevronLeft className="w-6 h-6 text-primary-dark" />
              </button>
              <button
                onClick={nextCarousel}
                disabled={carouselStartIndex + imagesPerPage >= productsWithImages.length}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-neutral-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next products"
              >
                <ChevronRight className="w-6 h-6 text-primary-dark" />
              </button>
            </>
          )}

          {/* Product Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibleProducts.map((product, index) => (
              <div
                key={product.id}
                className="relative aspect-square bg-neutral-light rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => openLightbox(carouselStartIndex + index)}
              >
                <OptimizedImage
                  src={product.image_url!}
                  alt={product.name}
                  fill
                  layout="gallery"
                  enableBlur
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  quality={85}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-end">
                  <div className="p-3 w-full bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-white text-sm font-semibold line-clamp-2">
                      {product.name}
                    </p>
                    {product.brand && (
                      <p className="text-white/90 text-xs mt-1">
                        {product.brand}
                      </p>
                    )}
                    {product.category && (
                      <p className="text-white/80 text-xs">
                        {product.category}
                        {product.subcategory && ` • ${product.subcategory}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Indicator */}
          {productsWithImages.length > imagesPerPage && (
            <div className="flex justify-center mt-6 space-x-2">
              {Array.from({
                length: Math.ceil(productsWithImages.length / imagesPerPage),
              }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCarouselStartIndex(index * imagesPerPage)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    Math.floor(carouselStartIndex / imagesPerPage) === index
                      ? 'bg-primary-orange w-8'
                      : 'bg-neutral-medium hover:bg-primary-gray'
                  }`}
                  aria-label={`Go to page ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-primary-orange transition-colors z-10"
            aria-label="Close lightbox"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Navigation Buttons */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
            className="absolute left-4 text-white hover:text-primary-orange transition-colors z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-12 h-12" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
            className="absolute right-4 text-white hover:text-primary-orange transition-colors z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-12 h-12" />
          </button>

          {/* Image */}
          <div
            className="relative w-full h-full max-w-5xl max-h-[90vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={productsWithImages[currentImageIndex].image_url!}
              alt={productsWithImages[currentImageIndex].name}
              fill
              className="object-contain"
              priority
              sizes="100vw"
            />
            
            {/* Image Info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <h3 className="text-white text-xl font-heading font-bold mb-1">
                {productsWithImages[currentImageIndex].name}
              </h3>
              {productsWithImages[currentImageIndex].brand && (
                <p className="text-white/90 text-sm mb-1">
                  {productsWithImages[currentImageIndex].brand}
                </p>
              )}
              {productsWithImages[currentImageIndex].category && (
                <p className="text-white/80">
                  {productsWithImages[currentImageIndex].category}
                  {productsWithImages[currentImageIndex].subcategory && 
                    ` • ${productsWithImages[currentImageIndex].subcategory}`}
                </p>
              )}
              {productsWithImages[currentImageIndex].description && (
                <p className="text-white/70 text-sm mt-2 line-clamp-2">
                  {productsWithImages[currentImageIndex].description}
                </p>
              )}
              <p className="text-white/60 text-sm mt-2">
                {currentImageIndex + 1} / {productsWithImages.length}
              </p>
            </div>
          </div>

          {/* Keyboard hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            Use arrow keys or click to navigate
          </div>
        </div>
      )}
    </>
  );
}
