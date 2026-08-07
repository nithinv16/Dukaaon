/**
 * Image Optimization Script
 * Compresses large images in the assets folder to reduce app size
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesToOptimize = [
    {
        input: 'assets/icons/seller_shop.jpg',
        output: 'assets/icons/seller_shop.jpg',
        width: 400,
        quality: 60
    },
    {
        input: 'assets/images/connecting-retailers.png',
        output: 'assets/images/connecting-retailers.png',
        width: 800,
        quality: 70
    },
    {
        input: 'assets/images/categories/flour.png',
        output: 'assets/images/categories/flour.png',
        width: 256,
        quality: 80
    },
    {
        input: 'assets/images/categories/snacks.png',
        output: 'assets/images/categories/snacks.png',
        width: 256,
        quality: 80
    },
    {
        input: 'assets/images/categories/beverages.png',
        output: 'assets/images/categories/beverages.png',
        width: 256,
        quality: 80
    },
    {
        input: 'assets/images/categories/more.png',
        output: 'assets/images/categories/more.png',
        width: 256,
        quality: 80
    },
    {
        input: 'assets/images/products/wheat.jpg',
        output: 'assets/images/products/wheat.jpg',
        width: 400,
        quality: 70
    },
    {
        input: 'assets/images/categories/groceries.png',
        output: 'assets/images/categories/groceries.png',
        width: 256,
        quality: 80
    }
];

async function optimizeImages() {
    console.log('Starting image optimization...\n');

    for (const img of imagesToOptimize) {
        try {
            if (!fs.existsSync(img.input)) {
                console.log(`⚠️  Skipping ${img.input} (file not found)`);
                continue;
            }

            const originalSize = fs.statSync(img.input).size;
            const ext = path.extname(img.input).toLowerCase();

            // Create backup
            const backupPath = img.input + '.backup';
            if (!fs.existsSync(backupPath)) {
                fs.copyFileSync(img.input, backupPath);
            }

            let sharpInstance = sharp(img.input).resize(img.width, null, {
                withoutEnlargement: true,
                fit: 'inside'
            });

            if (ext === '.jpg' || ext === '.jpeg') {
                await sharpInstance.jpeg({ quality: img.quality, mozjpeg: true }).toFile(img.output + '.temp');
            } else if (ext === '.png') {
                await sharpInstance.png({ quality: img.quality, compressionLevel: 9 }).toFile(img.output + '.temp');
            }

            // Replace original with optimized
            fs.unlinkSync(img.input);
            fs.renameSync(img.output + '.temp', img.output);

            const newSize = fs.statSync(img.output).size;
            const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);

            console.log(`✅ ${img.input}`);
            console.log(`   ${(originalSize / 1024).toFixed(0)} KB → ${(newSize / 1024).toFixed(0)} KB (${savings}% smaller)\n`);

        } catch (error) {
            console.log(`❌ Error processing ${img.input}: ${error.message}\n`);
        }
    }

    console.log('Image optimization complete!');
}

optimizeImages();
