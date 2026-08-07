/**
 * Image Optimization Script
 * 
 * This script helps optimize images for the website:
 * - Converts images to WebP format
 * - Compresses images
 * - Generates different sizes for responsive images
 * 
 * Usage:
 *   node scripts/optimize-images.js <input-directory> <output-directory>
 * 
 * Note: Requires sharp package
 *   npm install --save-dev sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('Error: sharp package is not installed.');
  console.error('Please install it with: npm install --save-dev sharp');
  process.exit(1);
}

// Configuration
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.webp'];
const OUTPUT_FORMATS = ['webp', 'avif'];
const RESPONSIVE_SIZES = [640, 750, 828, 1080, 1200, 1920];
const QUALITY = {
  webp: 80,
  avif: 75,
  jpeg: 85,
};

/**
 * Get all image files from a directory recursively
 */
function getImageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getImageFiles(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_FORMATS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

/**
 * Optimize a single image
 */
async function optimizeImage(inputPath, outputDir, options = {}) {
  const { generateResponsive = false, formats = OUTPUT_FORMATS } = options;
  
  const filename = path.basename(inputPath, path.extname(inputPath));
  const relativePath = path.dirname(inputPath);
  
  // Create output directory structure
  const outputPath = path.join(outputDir, path.relative(process.cwd(), relativePath));
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  console.log(`Optimizing: ${inputPath}`);

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Generate optimized versions in different formats
    for (const format of formats) {
      if (generateResponsive) {
        // Generate responsive sizes
        for (const size of RESPONSIVE_SIZES) {
          if (size <= metadata.width) {
            const outputFile = path.join(
              outputPath,
              `${filename}-${size}w.${format}`
            );

            await image
              .clone()
              .resize(size, null, { withoutEnlargement: true })
              [format]({ quality: QUALITY[format] })
              .toFile(outputFile);

            console.log(`  ✓ Generated: ${outputFile}`);
          }
        }
      } else {
        // Generate single optimized version
        const outputFile = path.join(outputPath, `${filename}.${format}`);

        await image
          .clone()
          [format]({ quality: QUALITY[format] })
          .toFile(outputFile);

        console.log(`  ✓ Generated: ${outputFile}`);
      }
    }

    // Also save optimized original format
    const originalFormat = metadata.format;
    if (originalFormat && QUALITY[originalFormat]) {
      const outputFile = path.join(outputPath, `${filename}-optimized.${originalFormat}`);
      
      await image
        .clone()
        [originalFormat]({ quality: QUALITY[originalFormat] })
        .toFile(outputFile);

      console.log(`  ✓ Generated: ${outputFile}`);
    }

    return true;
  } catch (error) {
    console.error(`  ✗ Error optimizing ${inputPath}:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node scripts/optimize-images.js <input-directory> <output-directory>');
    console.log('');
    console.log('Options:');
    console.log('  --responsive    Generate responsive image sizes');
    console.log('  --webp-only     Generate only WebP format');
    console.log('  --avif-only     Generate only AVIF format');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/optimize-images.js ./public/images ./public/optimized --responsive');
    process.exit(1);
  }

  const inputDir = args[0];
  const outputDir = args[1];
  const generateResponsive = args.includes('--responsive');
  
  let formats = OUTPUT_FORMATS;
  if (args.includes('--webp-only')) {
    formats = ['webp'];
  } else if (args.includes('--avif-only')) {
    formats = ['avif'];
  }

  // Validate input directory
  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Input directory "${inputDir}" does not exist.`);
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Image Optimization Script');
  console.log('========================');
  console.log(`Input directory: ${inputDir}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Formats: ${formats.join(', ')}`);
  console.log(`Responsive sizes: ${generateResponsive ? 'Yes' : 'No'}`);
  console.log('');

  // Get all image files
  const imageFiles = getImageFiles(inputDir);
  console.log(`Found ${imageFiles.length} image(s) to optimize\n`);

  if (imageFiles.length === 0) {
    console.log('No images found to optimize.');
    process.exit(0);
  }

  // Optimize all images
  let successCount = 0;
  let errorCount = 0;

  for (const imagePath of imageFiles) {
    const success = await optimizeImage(imagePath, outputDir, {
      generateResponsive,
      formats,
    });

    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
  }

  console.log('');
  console.log('========================');
  console.log(`Optimization complete!`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
