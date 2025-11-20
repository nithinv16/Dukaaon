# Scripts

This directory contains utility scripts for the DukaaOn website.

## Available Scripts

### optimize-images.js

Optimizes images for web delivery by converting to modern formats (WebP, AVIF) and compressing them.

**Installation:**
```bash
npm install --save-dev sharp
```

**Usage:**
```bash
# Basic optimization
node scripts/optimize-images.js <input-dir> <output-dir>

# Generate responsive sizes
node scripts/optimize-images.js <input-dir> <output-dir> --responsive

# Generate only WebP
node scripts/optimize-images.js <input-dir> <output-dir> --webp-only

# Generate only AVIF
node scripts/optimize-images.js <input-dir> <output-dir> --avif-only
```

**Examples:**
```bash
# Optimize all images in public/images
node scripts/optimize-images.js ./public/images ./public/optimized

# Generate responsive sizes for product images
node scripts/optimize-images.js ./public/products ./public/products-optimized --responsive
```

**Features:**
- Converts images to WebP and AVIF formats
- Compresses images with optimal quality settings
- Generates responsive image sizes (640, 750, 828, 1080, 1200, 1920)
- Preserves directory structure
- Supports JPG, PNG, GIF, TIFF formats

### test-api-routes.ts

Tests API routes to ensure they're working correctly.

**Usage:**
```bash
npx tsx scripts/test-api-routes.ts
```

## Adding New Scripts

When adding new scripts:

1. Create the script file in this directory
2. Add documentation to this README
3. Add npm script to package.json if needed
4. Make sure to handle errors gracefully
5. Add helpful console output

## Best Practices

- Use TypeScript for type safety when possible
- Add proper error handling
- Include usage instructions in comments
- Log progress and results
- Make scripts idempotent when possible
