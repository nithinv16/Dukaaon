import React, { useState, useEffect } from 'react';
import { Image, ImageProps } from 'react-native';
import { getCategoryImage } from '../../constants/categoryImages';
import { categoryImageService } from '../../services/categoryImageService';

interface CategoryImageProps extends Omit<ImageProps, 'source'> {
  categoryId: string;
  useDatabase?: boolean;
  fallbackToLocal?: boolean;
}

export const CategoryImage: React.FC<CategoryImageProps> = ({
  categoryId,
  useDatabase = true,
  fallbackToLocal = true,
  ...imageProps
}) => {
  const [imageSource, setImageSource] = useState(getCategoryImage(categoryId));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (useDatabase) {
      loadCategoryImage();
    }
  }, [categoryId, useDatabase]);

  const loadCategoryImage = async () => {
    setIsLoading(true);
    try {
      const dbImage = await categoryImageService.getCategoryImageWithDB(categoryId);
      setImageSource(dbImage);
    } catch (error) {
      console.warn('Failed to load category image from DB:', error);
      if (fallbackToLocal) {
        setImageSource(getCategoryImage(categoryId));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageError = () => {
    if (fallbackToLocal) {
      setImageSource(getCategoryImage(categoryId));
    }
  };

  return (
    <Image
      {...imageProps}
      source={imageSource}
      onError={handleImageError}
    />
  );
};

export default CategoryImage;