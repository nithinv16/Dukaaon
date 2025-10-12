#!/usr/bin/env node
/**
 * Wrapper script for prepare-for-eas.js that ignores the --platform parameter
 * This works around the "unknown or unexpected option: --platform" error in EAS builds
 */

const { spawnSync } = require('child_process');
const path = require('path');

// Filter out the --platform parameter and its value
const args = process.argv.slice(2);
const filteredArgs = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--platform') {
    // Skip --platform and its value
    i++;
    continue;
  } else {
    filteredArgs.push(args[i]);
  }
}

console.log('Running prepare-for-eas.js without platform argument...');
const prepareScript = path.join(__dirname, 'prepare-for-eas.js');

const result = spawnSync('node', [prepareScript, ...filteredArgs], {
  stdio: 'inherit',
  encoding: 'utf-8'
});

// Exit with the same exit code as the prepare script
process.exit(result.status); 