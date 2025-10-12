/**
 * Script to update all expo-status-bar imports to use SystemStatusBar
 * This addresses Android 15 deprecated API warnings
 */

const fs = require('fs');
const path = require('path');

// Files to update (excluding already updated ones)
const filesToUpdate = [
  'app/(auth)/retailer-kyc.tsx',
  'app/(auth)/kyc.tsx',
  'app/(main)/wholesaler/profile.tsx',
  'app/(main)/payment/add.tsx',
  'app/(auth)/seller-kyc.tsx',
  'app/(main)/orders/index.tsx',
  'app/(main)/wholesaler/loan.tsx',
  'app/(auth)/email-verification.tsx',
  'app/(auth)/wholesaler-kyc.tsx',
  'app/(auth)/login.tsx',
  'app/(auth)/otp.tsx',
  'app/(main)/wholesaler/index.tsx',
  'app/(main)/phone-order/index.tsx',
  'app/(auth)/language.tsx'
];

function updateFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let updated = false;
  
  // Replace expo-status-bar import
  if (content.includes("import { StatusBar } from 'expo-status-bar';")) {
    // Calculate the correct relative path to SystemStatusBar
    const depth = filePath.split('/').length - 1;
    const relativePath = '../'.repeat(depth) + 'components/SystemStatusBar';
    
    content = content.replace(
      "import { StatusBar } from 'expo-status-bar';",
      `import { SystemStatusBar } from '${relativePath}';`
    );
    updated = true;
  }
  
  // Replace StatusBar usage with SystemStatusBar
  if (content.includes('<StatusBar')) {
    content = content.replace(/<StatusBar/g, '<SystemStatusBar');
    updated = true;
  }
  
  if (updated) {
    fs.writeFileSync(fullPath, content);
    console.log(`Updated: ${filePath}`);
  } else {
    console.log(`No changes needed: ${filePath}`);
  }
}

// Update all files
console.log('Updating expo-status-bar imports to SystemStatusBar...');
filesToUpdate.forEach(updateFile);
console.log('Update complete!');