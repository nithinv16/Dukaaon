'use strict';

/**
 * Admin script to assign the 'authenticated' role custom claim to all existing Firebase users
 * This script should be run once after setting up Firebase Cloud Functions
 * 
 * Prerequisites:
 * 1. Firebase Admin SDK service account key
 * 2. Node.js environment with firebase-admin package
 * 
 * Usage:
 * node scripts/assign-firebase-roles.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');

// Initialize Firebase Admin SDK
// Make sure to place your service account key in the credentials directory
try {
  const serviceAccount = require('../credentials/firebase-service-account-key.json');
  
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || 'dukaaon'
  });
  
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error.message);
  console.log('\nPlease ensure you have:');
  console.log('1. Downloaded your Firebase service account key');
  console.log('2. Placed it at: credentials/firebase-service-account-key.json');
  console.log('3. Set FIREBASE_PROJECT_ID environment variable (optional)');
  process.exit(1);
}

/**
 * Main function to assign role custom claims to all users
 */
async function setRoleCustomClaim() {
  let nextPageToken = undefined;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  
  console.log('Starting to assign \'authenticated\' role to all Firebase users...');
  console.log('This may take a while for large user bases.\n');
  
  try {
    do {
      // List users in batches of 1000
      const listUsersResult = await getAuth().listUsers(1000, nextPageToken);
      nextPageToken = listUsersResult.pageToken;
      
      console.log(`Processing batch of ${listUsersResult.users.length} users...`);
      
      // Process users in parallel with controlled concurrency
      const batchPromises = listUsersResult.users.map(async (userRecord) => {
        try {
          // Check if user already has the role claim
          const existingClaims = userRecord.customClaims || {};
          
          if (existingClaims.role === 'authenticated') {
            console.log(`User ${userRecord.uid} already has authenticated role`);
            return { updated: false, error: null };
          }
          
          // Set the role custom claim
          await getAuth().setCustomUserClaims(userRecord.uid, {
            ...existingClaims,
            role: 'authenticated'
          });
          
          console.log(`✓ Successfully set role for user: ${userRecord.uid} (${userRecord.email || 'no email'})`);
          return { updated: true, error: null };
          
        } catch (error) {
          console.error(`✗ Failed to set custom role for user ${userRecord.uid}:`, error.message);
          return { updated: false, error: error.message };
        }
      });
      
      // Wait for all promises in this batch to complete
      const results = await Promise.all(batchPromises);
      
      // Count results
      const batchUpdated = results.filter(r => r.updated).length;
      const batchErrors = results.filter(r => r.error).length;
      
      totalProcessed += listUsersResult.users.length;
      totalUpdated += batchUpdated;
      totalErrors += batchErrors;
      
      console.log(`Batch completed: ${batchUpdated} updated, ${batchErrors} errors\n`);
      
      // Add a small delay between batches to avoid rate limiting
      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } while (nextPageToken);
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total users processed: ${totalProcessed}`);
    console.log(`Total users updated: ${totalUpdated}`);
    console.log(`Total errors: ${totalErrors}`);
    
    if (totalErrors === 0) {
      console.log('\n✅ All users successfully updated with authenticated role!');
    } else {
      console.log(`\n⚠️  Completed with ${totalErrors} errors. Check the logs above for details.`);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error during role assignment:', error);
    process.exit(1);
  }
}

/**
 * Verify the setup by checking a few users
 */
async function verifySetup() {
  try {
    console.log('\n=== VERIFICATION ===');
    const listUsersResult = await getAuth().listUsers(5); // Check first 5 users
    
    if (listUsersResult.users.length === 0) {
      console.log('No users found in Firebase Auth.');
      return;
    }
    
    console.log('Checking custom claims for sample users:');
    
    for (const user of listUsersResult.users) {
      const claims = user.customClaims || {};
      const hasRole = claims.role === 'authenticated';
      
      console.log(`User ${user.uid}: role = ${claims.role || 'none'} ${hasRole ? '✓' : '✗'}`);
    }
    
  } catch (error) {
    console.error('Verification failed:', error);
  }
}

// Main execution
if (require.main === module) {
  setRoleCustomClaim()
    .then(() => verifySetup())
    .then(() => {
      console.log('\n🎉 Script completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Deploy your Firebase Cloud Functions: firebase deploy --only functions');
      console.log('2. Test the integration with your Supabase project');
      console.log('3. Verify that new users automatically get the authenticated role');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { setRoleCustomClaim, verifySetup };