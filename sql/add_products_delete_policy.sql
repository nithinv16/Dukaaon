-- Add DELETE policy for products table
-- This allows sellers to delete their own products

-- First, check if policy exists and drop it if needed
DROP POLICY IF EXISTS "Sellers can delete their own products" ON public.products;

-- Create the DELETE policy for products
CREATE POLICY "Sellers can delete their own products"
ON public.products
FOR DELETE
USING (
  -- Allow deletion if the seller_id matches the authenticated user
  seller_id = auth.uid()
);

-- Also make sure there's a DELETE policy for product_variants
DROP POLICY IF EXISTS "Sellers can delete their own product variants" ON public.product_variants;

-- Create the DELETE policy for product_variants
CREATE POLICY "Sellers can delete their own product variants"
ON public.product_variants
FOR DELETE
USING (
  -- Allow deletion if the product belongs to the authenticated user
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_variants.product_id
    AND products.seller_id = auth.uid()
  )
);

-- Verify policies exist
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('products', 'product_variants')
ORDER BY tablename, policyname;
