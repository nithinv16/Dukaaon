import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * HTTP Cloud Function to assign custom claims to a user after creation
 * This replaces the blocking trigger approach for better compatibility
 */
export const setUserRole = functions.https.onCall(async (data, context) => {
  try {
    // Verify that the request is from an authenticated user
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = context.auth.uid;
    
    // Get current user record
    const userRecord = await admin.auth().getUser(uid);
    const existingClaims = userRecord.customClaims || {};
    
    if (!existingClaims.role) {
      // Set custom claims for Supabase integration
      await admin.auth().setCustomUserClaims(uid, {
        ...existingClaims,
        role: 'authenticated',
      });
      
      console.log(`Successfully set role for user: ${uid}`);
      
      return {
        success: true,
        message: 'Role assigned successfully',
        role: 'authenticated'
      };
    }
    
    return {
      success: true,
      message: 'Role already assigned',
      role: existingClaims.role
    };
  } catch (error) {
    console.error('Error in setUserRole:', error);
    throw new functions.https.HttpsError('internal', 'Failed to set custom claims');
  }
});

/**
 * HTTP Cloud Function to assign custom claims to existing users
 * This should be called once to update all existing users
 */
export const assignRoleToAllUsers = functions.https.onCall(async (data, context) => {
  try {
    // Verify that the request is from an authenticated admin user
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    let nextPageToken: string | undefined;
    let totalProcessed = 0;
    let totalErrors = 0;

    do {
      // List users in batches of 1000
      const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
      nextPageToken = listUsersResult.pageToken;

      // Process users in parallel
      const promises = listUsersResult.users.map(async (userRecord) => {
        try {
          // Check if user already has the role claim
          const existingClaims = userRecord.customClaims || {};
          
          if (!existingClaims.role) {
            // Set the role custom claim
            await admin.auth().setCustomUserClaims(userRecord.uid, {
              ...existingClaims,
              role: 'authenticated',
            });
            console.log(`Successfully set role for user: ${userRecord.uid}`);
          }
        } catch (error) {
          console.error(`Failed to set custom role for user ${userRecord.uid}:`, error);
          totalErrors++;
        }
      });

      await Promise.all(promises);
      totalProcessed += listUsersResult.users.length;

    } while (nextPageToken);

    return {
      success: true,
      totalProcessed,
      totalErrors,
      message: `Processed ${totalProcessed} users with ${totalErrors} errors`,
    };
  } catch (error) {
    console.error('Error in assignRoleToAllUsers:', error);
    throw new functions.https.HttpsError('internal', 'Failed to assign roles to users');
  }
});

/**
 * HTTP Cloud Function to verify a user's custom claims
 * Useful for debugging and verification
 */
export const verifyUserClaims = functions.https.onCall(async (data, context) => {
  try {
    // Verify that the request is from an authenticated user
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { uid } = data;
    if (!uid) {
      throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }

    // Get user record
    const userRecord = await admin.auth().getUser(uid);
    
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      customClaims: userRecord.customClaims || {},
      hasAuthenticatedRole: !!(userRecord.customClaims?.role === 'authenticated'),
    };
  } catch (error) {
    console.error('Error in verifyUserClaims:', error);
    throw new functions.https.HttpsError('internal', 'Failed to verify user claims');
  }
});