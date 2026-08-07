/**
 * Script to remove PDF files from project root
 * These are documentation files and should not be in the app bundle
 */

const fs = require('fs');
const path = require('path');

const pdfFiles = [
  'Build Details — 813e2b69-6361-4a88-9847-2b18372e2c63 — @nithinv16_dukaaon — Expo.pdf',
  'AI agent azure doc.pdf',
  'Android API requirements.pdf'
];

console.log('Removing PDF files from project root...');

pdfFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ Removed: ${file}`);
    } catch (error) {
      console.error(`❌ Error removing ${file}:`, error.message);
    }
  } else {
    console.log(`⚠️  Not found: ${file}`);
  }
});

console.log('\n✅ PDF cleanup complete!');
console.log('Note: These files are documentation and should not be in the app bundle.');



