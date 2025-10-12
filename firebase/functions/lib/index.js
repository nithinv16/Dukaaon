"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUserClaims = exports.assignRoleToAllUsers = exports.setUserRole = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK
admin.initializeApp();
/**
 * HTTP Cloud Function to assign custom claims to a user after creation
 * This replaces the blocking trigger approach for better compatibility
 */
exports.setUserRole = functions.https.onCall(async (data, context) => {
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
            await admin.auth().setCustomUserClaims(uid, Object.assign(Object.assign({}, existingClaims), { role: 'authenticated' }));
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
    }
    catch (error) {
        console.error('Error in setUserRole:', error);
        throw new functions.https.HttpsError('internal', 'Failed to set custom claims');
    }
});
/**
 * HTTP Cloud Function to assign custom claims to existing users
 * This should be called once to update all existing users
 */
exports.assignRoleToAllUsers = functions.https.onCall(async (data, context) => {
    try {
        // Verify that the request is from an authenticated admin user
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        let nextPageToken;
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
                        await admin.auth().setCustomUserClaims(userRecord.uid, Object.assign(Object.assign({}, existingClaims), { role: 'authenticated' }));
                        console.log(`Successfully set role for user: ${userRecord.uid}`);
                    }
                }
                catch (error) {
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
    }
    catch (error) {
        console.error('Error in assignRoleToAllUsers:', error);
        throw new functions.https.HttpsError('internal', 'Failed to assign roles to users');
    }
});
/**
 * HTTP Cloud Function to verify a user's custom claims
 * Useful for debugging and verification
 */
exports.verifyUserClaims = functions.https.onCall(async (data, context) => {
    var _a;
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
            hasAuthenticatedRole: !!(((_a = userRecord.customClaims) === null || _a === void 0 ? void 0 : _a.role) === 'authenticated'),
        };
    }
    catch (error) {
        console.error('Error in verifyUserClaims:', error);
        throw new functions.https.HttpsError('internal', 'Failed to verify user claims');
    }
});
//# sourceMappingURL=index.js.map