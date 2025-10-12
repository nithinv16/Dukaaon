import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { getProductImage } from '../../constants/categoryImages';

interface ProductImageProps {
  imageUrl?: string | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

export const ProductImage: React.FC<ProductImageProps> = ({ 
  imageUrl, 
  style, 
  resizeMode = 'cover' 
}) => {
  const imageSource = getProductImage(imageUrl);
  
  return (
    <Image
      source={imageSource}
      style={style}
      resizeMode={resizeMode}
      defaultSource={require('../../assets/images/products/dummy_product_image.jpg')}
    />
  );
};

export default ProductImage;