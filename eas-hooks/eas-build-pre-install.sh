#!/bin/bash

# EAS Build Pre-Install Hook
# This script runs before dependencies are installed during EAS build
# It ensures our exclusion strategies are properly applied

echo "🔧 EAS Build Pre-Install Hook: Setting up exclusion environment..."

# Set environment variables for aggressive exclusion
export ANDROID_USE_ANDROIDX=true
export ANDROID_ENABLE_JETIFIER=false
export ANDROID_DEPENDENCY_EXCLUDE_GROUPS=com.android.support
export ANDROID_DEPENDENCY_FORCE_REPLACE=true
export ANDROID_DEPENDENCY_STRICT_MODE=true
export ANDROID_DEPENDENCY_FAIL_ON_CONFLICT=true
export ANDROID_DEPENDENCY_REJECT_SUPPORT_LIBRARIES=true
export ANDROID_FORCE_ANDROIDX_ONLY=true
export ANDROID_REJECT_SUPPORT_LIBRARIES=true
export ANDROID_ENABLE_STRICT_DEPENDENCY_CHECKING=true

# Enhanced Gradle options for EAS build
export GRADLE_OPTS="-Xmx8g -XX:MaxMetaspaceSize=2g -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -Dfile.encoding=UTF-8 -Dorg.gradle.jvmargs=-Xmx8g"

# Disable problematic Gradle features
export ORG_GRADLE_PROJECT_android_useAndroidX=true
export ORG_GRADLE_PROJECT_android_enableJetifier=false
export ORG_GRADLE_PROJECT_android_dependency_excludeGroups=com.android.support
export ORG_GRADLE_PROJECT_android_dependency_forceReplace=true
export ORG_GRADLE_PROJECT_android_dependency_strictMode=true
export ORG_GRADLE_PROJECT_android_dependency_failOnConflict=true
export ORG_GRADLE_PROJECT_android_dependency_rejectSupportLibraries=true
export ORG_GRADLE_PROJECT_android_forceAndroidXOnly=true
export ORG_GRADLE_PROJECT_android_rejectSupportLibraries=true
export ORG_GRADLE_PROJECT_android_enableStrictDependencyChecking=true

# Additional Gradle project properties
export ORG_GRADLE_PROJECT_org_gradle_parallel=true
export ORG_GRADLE_PROJECT_org_gradle_daemon=true
export ORG_GRADLE_PROJECT_org_gradle_configureondemand=false
export ORG_GRADLE_PROJECT_org_gradle_caching=false
export ORG_GRADLE_PROJECT_org_gradle_dependency_verification=off
export ORG_GRADLE_PROJECT_org_gradle_dependency_locking=false
export ORG_GRADLE_PROJECT_org_gradle_dependency_cache_cleanup=true
export ORG_GRADLE_PROJECT_org_gradle_dependency_resolution_strict=true

echo "✅ Environment variables set for aggressive support library exclusion"
echo "✅ Gradle options configured for optimal performance"
echo "✅ EAS Build Pre-Install Hook completed successfully"