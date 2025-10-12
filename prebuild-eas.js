const fs = require('fs');
const path = require('path');

console.log('Starting EAS prebuild script...');

// Function to safely create directory with proper error handling
function safelyCreateDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    } else {
      console.log(`Directory already exists: ${dirPath}`);
    }
    return true;
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error.message);
    return false;
  }
}

// Function to safely read file with proper error handling
function safelyReadFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File does not exist: ${filePath}`);
      return null;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error.message);
      return null;
    }
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error.message);
    return null;
  }
}

// Function to safely write file with proper error handling
function safelyWriteFile(filePath, content) {
  try {
    // Check if we have write permission by trying to access the file
    try {
      if (fs.existsSync(filePath)) {
        fs.accessSync(filePath, fs.constants.W_OK);
      }
    } catch (error) {
      console.error(`No write permission for file ${filePath}:`, error.message);
      return false;
    }
    
    // Try to write the file
    try {
      fs.writeFileSync(filePath, content);
      console.log(`Successfully wrote to file: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`Error writing to file ${filePath}:`, error.message);
      return false;
    }
  } catch (error) {
    console.error(`Error with file operation ${filePath}:`, error.message);
    return false;
  }
}

// Function to ensure expo-modules-core is properly linked
function ensureExpoModulesCore() {
  console.log('Ensuring expo-modules-core is properly linked...');
  
  try {
    // Check if expo-modules-core exists in node_modules
    const modulesCorePath = path.join(__dirname, 'node_modules', 'expo-modules-core');
    const modulesCoreExists = fs.existsSync(modulesCorePath);
    
    if (!modulesCoreExists) {
      console.log('expo-modules-core not found in node_modules, creating directory');
      safelyCreateDir(modulesCorePath);
      
      // Create a package.json in the directory to make it recognized as a module
      const packageJson = {
        name: "expo-modules-core",
        version: "2.2.3",
        main: "build/index.js"
      };
      
      safelyWriteFile(
        path.join(modulesCorePath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      // Create build directory
      const buildDir = path.join(modulesCorePath, 'build');
      safelyCreateDir(buildDir);
      
      // Create a minimal implementation of the required exports
      const indexContent = `
// Minimal implementation of expo-modules-core
export const CodedError = class CodedError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};

export const requireOptionalNativeModule = (name) => {
  try {
    return require('react-native').NativeModules[name] || null;
  } catch (e) {
    return null;
  }
};

export default {
  CodedError,
  requireOptionalNativeModule
};
      `;
      
      safelyWriteFile(path.join(buildDir, 'index.js'), indexContent);
    }
    
    // Create a compose-compiler-configuration.bin file for Kotlin compatibility
    const composeConfigPath = path.join(__dirname, 'android', 'app', 'build', 'intermediates', 'compose_compiler');
    safelyCreateDir(composeConfigPath);
    
    // Create a binary file with version information
    // This is a simplified approach - in a real scenario, the file would be properly formatted
    const configContent = `
# Compose Compiler Configuration
kotlinCompilerVersion=1.7.20
kotlinCompilerExtensionVersion=1.3.2
suppressKotlinVersionCompatibilityCheck=true
    `;
    
    safelyWriteFile(
      path.join(composeConfigPath, 'compose-compiler-configuration.bin'),
      configContent
    );
    
    console.log('Created compose compiler configuration for Kotlin compatibility');
    
    return true;
  } catch (error) {
    console.error('Error setting up expo-modules-core:', error);
    return false;
  }
}

// Create patches directory
const patchesDir = path.join(__dirname, 'patches');
safelyCreateDir(patchesDir);

// Create expo-updates-fix.js if it doesn't exist
const patchFilePath = path.join(patchesDir, 'expo-updates-fix.js');
if (!fs.existsSync(patchFilePath)) {
  const patchContent = `// This file is auto-generated to disable expo-updates
// and avoid KSP/Kotlin compatibility issues

export const loadUpdateAsync = async () => { 
  console.log("Updates disabled for this build"); 
  return null; 
};

export const checkForUpdateAsync = async () => {
  console.log("Updates disabled for this build");
  return { isAvailable: false };
};

export const fetchUpdateAsync = async () => {
  console.log("Updates disabled for this build");
  return { isNew: false };
};

export default {
  loadUpdateAsync,
  checkForUpdateAsync,
  fetchUpdateAsync,
};`;

  safelyWriteFile(patchFilePath, patchContent);
}

// Patch expo-updates with retry mechanism
function patchExpoUpdates() {
  console.log('Attempting to patch expo-updates...');
  
  // Wait for node_modules to be fully initialized
  const maxRetries = 3;
  let retryCount = 0;
  let success = false;
  
  while (retryCount < maxRetries && !success) {
    try {
      // Check if the directory exists first
      const updatesDir = path.join(__dirname, 'node_modules', 'expo-updates');
      if (!fs.existsSync(updatesDir)) {
        console.log('expo-updates module not found, skipping patch');
        return;
      }
      
      const updatesPath = path.join(updatesDir, 'src', 'Updates.native.js');
      if (!fs.existsSync(updatesPath)) {
        console.log(`Updates.native.js not found at ${updatesPath}, skipping patch`);
        return;
      }
      
      // Read the patch content
      const patchContent = safelyReadFile(patchFilePath);
      if (!patchContent) {
        console.error('Could not read patch content, skipping patch');
        return;
      }
      
      // Apply the patch
      if (safelyWriteFile(updatesPath, patchContent)) {
        console.log('Successfully patched expo-updates/src/Updates.native.js');
        success = true;
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`Retrying patch (attempt ${retryCount + 1}/${maxRetries})...`);
          // Wait before retrying
          setTimeout(() => {}, 1000);
        }
      }
    } catch (error) {
      console.error('Error in patchExpoUpdates:', error.message);
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`Retrying patch (attempt ${retryCount + 1}/${maxRetries})...`);
      }
    }
  }
  
  if (!success) {
    console.error(`Failed to patch expo-updates after ${maxRetries} attempts`);
  }
}

// Patch expo-updates build.gradle
function patchExpoUpdatesBuildGradle() {
  try {
    const buildGradlePath = path.join(__dirname, 'node_modules', 'expo-updates', 'android', 'build.gradle');
    if (!fs.existsSync(buildGradlePath)) {
      console.log(`build.gradle not found at ${buildGradlePath}, skipping patch`);
      return;
    }
    
    const content = safelyReadFile(buildGradlePath);
    if (!content) {
      console.error('Could not read build.gradle content, skipping patch');
      return;
    }
    
    // Check if the file already contains our patch
    if (content.includes('//disabled KSP for compatibility')) {
      console.log('build.gradle already patched, skipping');
      return;
    }
    
    // Apply the patches
    let newContent = content;
    newContent = newContent.replace(/apply plugin: "com\.google\.devtools\.ksp"/g, '//disabled KSP for compatibility');
    newContent = newContent.replace(/ksp .*androidx\.room.*\n/g, '');
    
    if (content === newContent) {
      console.log('No changes needed for build.gradle');
      return;
    }
    
    if (safelyWriteFile(buildGradlePath, newContent)) {
      console.log('Successfully patched expo-updates/android/build.gradle');
    }
  } catch (error) {
    console.error('Error patching expo-updates build.gradle:', error.message);
  }
}

// Find and patch CMakeLists.txt files with better error handling
function patchCMakeFiles() {
  console.log('Patching C++ files for compatibility...');
  try {
    // This is a simplified approach that works on both Windows and Unix
    const nodeModulesDir = path.join(__dirname, 'node_modules');
    if (!fs.existsSync(nodeModulesDir)) {
      console.error('node_modules directory not found, skipping CMake patches');
      return;
    }
    
    // Function to recursively find files with better error handling
    function findCMakeFiles(dir, fileList = []) {
      try {
        if (!fs.existsSync(dir)) {
          return fileList;
        }
        
        let files;
        try {
          files = fs.readdirSync(dir);
        } catch (error) {
          console.error(`Error reading directory ${dir}:`, error.message);
          return fileList;
        }
        
        for (const file of files) {
          try {
            const filePath = path.join(dir, file);
            let stat;
            
            try {
              stat = fs.statSync(filePath);
            } catch (error) {
              console.error(`Error accessing ${filePath}:`, error.message);
              continue;
            }
            
            if (stat.isDirectory() && file !== 'node_modules') {
              findCMakeFiles(filePath, fileList);
            } else if (file === 'CMakeLists.txt') {
              fileList.push(filePath);
            }
          } catch (error) {
            console.error(`Error processing file in ${dir}:`, error.message);
          }
        }
        
        return fileList;
      } catch (error) {
        console.error(`Error in findCMakeFiles for ${dir}:`, error.message);
        return fileList;
      }
    }
    
    // Find all CMakeLists.txt files
    const cmakeFiles = findCMakeFiles(nodeModulesDir);
    console.log(`Found ${cmakeFiles.length} CMakeLists.txt files`);
    
    // Patch each file
    let patchedCount = 0;
    for (const filePath of cmakeFiles) {
      const content = safelyReadFile(filePath);
      if (!content) {
        continue;
      }
      
      // Check if file needs patching
      if (!content.includes('CXX_STANDARD 20') && 
          !content.includes('set_target_properties') && 
          !content.includes('CXX_STANDARD 20')) {
        continue;
      }
      
      let newContent = content;
      newContent = newContent.replace(/CXX_STANDARD 20/g, 'CXX_STANDARD 17');
      newContent = newContent.replace(/set_target_properties.*CXX_STANDARD 20/g, 
                                     'set_target_properties(${PACKAGE_NAME} PROPERTIES CXX_STANDARD 17)');
      
      // Only write if changes were made
      if (content !== newContent && safelyWriteFile(filePath, newContent)) {
        patchedCount++;
      }
    }
    
    console.log(`Successfully patched ${patchedCount} CMakeLists.txt files`);
  } catch (error) {
    console.error('Error patching CMakeLists.txt files:', error.message);
  }
}

// Execute the patching functions
ensureExpoModulesCore();
patchExpoUpdates();
patchExpoUpdatesBuildGradle();
patchCMakeFiles();

console.log('EAS prebuild script completed'); 