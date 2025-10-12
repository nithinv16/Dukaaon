#!/bin/bash

# EAS Build Post-Install Hook
# This script runs after dependencies are installed during EAS build
# It verifies exclusions and cleans up any support library remnants

echo "🔍 EAS Build Post-Install Hook: Verifying exclusions and cleaning up..."

# Function to check for support libraries in node_modules
check_support_libraries() {
    echo "🔍 Checking for Android Support Libraries in node_modules..."
    
    # Search for support library packages
    SUPPORT_LIBS=$(find node_modules -name "*support*" -type d 2>/dev/null | grep -E "(com\.android\.support|android\.support)" || true)
    
    if [ -n "$SUPPORT_LIBS" ]; then
        echo "❌ Found support library directories:"
        echo "$SUPPORT_LIBS"
        
        # Remove support library directories
        echo "🧹 Removing support library directories..."
        echo "$SUPPORT_LIBS" | xargs rm -rf
        echo "✅ Support library directories removed"
    else
        echo "✅ No support library directories found"
    fi
}

# Function to check for support library files
check_support_files() {
    echo "🔍 Checking for Android Support Library files..."
    
    # Search for support library JAR and AAR files
    SUPPORT_FILES=$(find node_modules -name "*support*.jar" -o -name "*support*.aar" 2>/dev/null || true)
    
    if [ -n "$SUPPORT_FILES" ]; then
        echo "❌ Found support library files:"
        echo "$SUPPORT_FILES"
        
        # Remove support library files
        echo "🧹 Removing support library files..."
        echo "$SUPPORT_FILES" | xargs rm -f
        echo "✅ Support library files removed"
    else
        echo "✅ No support library files found"
    fi
}

# Function to verify package.json dependencies
verify_dependencies() {
    echo "🔍 Verifying package.json dependencies..."
    
    if [ -f "package.json" ]; then
        # Check for support library dependencies in package.json
        SUPPORT_DEPS=$(grep -E "(com\.android\.support|android\.support)" package.json || true)
        
        if [ -n "$SUPPORT_DEPS" ]; then
            echo "❌ Found support library dependencies in package.json:"
            echo "$SUPPORT_DEPS"
            echo "⚠️ Please remove these dependencies and use AndroidX equivalents"
        else
            echo "✅ No support library dependencies found in package.json"
        fi
    fi
}

# Function to clean gradle cache
clean_gradle_cache() {
    echo "🧹 Cleaning Gradle cache..."
    
    # Remove gradle cache directories that might contain support libraries
    if [ -d "$HOME/.gradle/caches" ]; then
        find "$HOME/.gradle/caches" -name "*support*" -type d -exec rm -rf {} + 2>/dev/null || true
        echo "✅ Gradle cache cleaned"
    fi
    
    # Clean local gradle cache if it exists
    if [ -d ".gradle" ]; then
        find ".gradle" -name "*support*" -type d -exec rm -rf {} + 2>/dev/null || true
        echo "✅ Local gradle cache cleaned"
    fi
}

# Function to verify AndroidX dependencies
verify_androidx_dependencies() {
    echo "🔍 Verifying AndroidX dependencies..."
    
    if [ -f "package.json" ]; then
        # Check for AndroidX dependencies
        ANDROIDX_DEPS=$(grep -E "androidx\.|@react-native-community" package.json || true)
        
        if [ -n "$ANDROIDX_DEPS" ]; then
            echo "✅ Found AndroidX dependencies:"
            echo "$ANDROIDX_DEPS" | head -5  # Show first 5 lines
        else
            echo "⚠️ No AndroidX dependencies found - this might be an issue"
        fi
    fi
}

# Function to create exclusion verification file
create_verification_file() {
    echo "📝 Creating exclusion verification file..."
    
    cat > exclusion-verification.txt << EOF
EAS Build Exclusion Verification Report
Generated: $(date)

Environment Variables:
ANDROID_USE_ANDROIDX: $ANDROID_USE_ANDROIDX
ANDROID_ENABLE_JETIFIER: $ANDROID_ENABLE_JETIFIER
ANDROID_DEPENDENCY_EXCLUDE_GROUPS: $ANDROID_DEPENDENCY_EXCLUDE_GROUPS
ANDROID_FORCE_ANDROIDX_ONLY: $ANDROID_FORCE_ANDROIDX_ONLY

Gradle Options:
GRADLE_OPTS: $GRADLE_OPTS

Verification Status:
- Support library directories: $([ -z "$(find node_modules -name "*support*" -type d 2>/dev/null | grep -E "(com\.android\.support|android\.support)" || true)" ] && echo "CLEAN" || echo "FOUND")
- Support library files: $([ -z "$(find node_modules -name "*support*.jar" -o -name "*support*.aar" 2>/dev/null || true)" ] && echo "CLEAN" || echo "FOUND")
- AndroidX dependencies: $([ -n "$(grep -E "androidx\.|@react-native-community" package.json 2>/dev/null || true)" ] && echo "PRESENT" || echo "MISSING")

Exclusion scripts applied:
- absolute-exclusions.gradle: $([ -f "absolute-exclusions.gradle" ] && echo "PRESENT" || echo "MISSING")
- nuclear-exclusions.gradle: $([ -f "nuclear-exclusions.gradle" ] && echo "PRESENT" || echo "MISSING")
- build-verification.gradle: $([ -f "build-verification.gradle" ] && echo "PRESENT" || echo "MISSING")

EOF

    echo "✅ Verification file created: exclusion-verification.txt"
}

# Run all verification and cleanup functions
check_support_libraries
check_support_files
verify_dependencies
clean_gradle_cache
verify_androidx_dependencies
create_verification_file

echo "✅ EAS Build Post-Install Hook completed successfully"
echo "📋 Check exclusion-verification.txt for detailed report"