/**
 * KYCService - Service for managing KYC verification for credit facility
 * 
 * Implements Requirements 4.4, 4.5, 4.9:
 * - Redirect to KYC flow for unverified users
 * - Update retailer's credit eligibility status after KYC completion
 * - Display KYC status with specific reasons and steps
 */

import { supabase } from '../supabase/supabase';
import { CreditService, KycStatus, CreditFacility } from './CreditService';

// ============================================================================
// Type Definitions
// ============================================================================

export interface KYCDocument {
  type: 'aadhaar' | 'pan' | 'gst' | 'shop_license' | 'bank_statement';
  url: string;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string;
  uploaded_at: string;
  verified_at?: string;
}

export interface KYCSubmission {
  retailer_id: string;
  documents: KYCDocument[];
  business_name: string;
  business_address: string;
  gst_number?: string;
  pan_number: string;
  aadhaar_number: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  submitted_at: string;
  status: KycStatus;
}

export interface KYCStatusResult {
  status: KycStatus;
  isVerified: boolean;
  canAccessCredit: boolean;
  rejectionReason?: string;
  pendingDocuments: string[];
  verifiedAt?: string;
  creditLimit?: number;
  nextSteps: string[];
}

export interface KYCRequirement {
  documentType: string;
  displayName: string;
  required: boolean;
  description: string;
}

// ============================================================================
// KYC Requirements Configuration
// ============================================================================

export const KYC_REQUIREMENTS: KYCRequirement[] = [
  {
    documentType: 'aadhaar',
    displayName: 'Aadhaar Card',
    required: true,
    description: 'Government-issued identity proof',
  },
  {
    documentType: 'pan',
    displayName: 'PAN Card',
    required: true,
    description: 'Tax identification document',
  },
  {
    documentType: 'gst',
    displayName: 'GST Certificate',
    required: false,
    description: 'GST registration certificate (if applicable)',
  },
  {
    documentType: 'shop_license',
    displayName: 'Shop License',
    required: true,
    description: 'Business registration or shop license',
  },
  {
    documentType: 'bank_statement',
    displayName: 'Bank Statement',
    required: true,
    description: 'Last 3 months bank statement',
  },
];

// ============================================================================
// KYC Status Messages
// ============================================================================

export const KYC_STATUS_MESSAGES: Record<KycStatus, string> = {
  pending: 'Your KYC verification is pending. Please complete all required documents.',
  verified: 'Your KYC is verified. You can now access credit facilities.',
  rejected: 'Your KYC verification was rejected. Please review and resubmit.',
};

export const KYC_REJECTION_REASONS: Record<string, string> = {
  document_unclear: 'Document image is unclear or unreadable',
  document_expired: 'Document has expired',
  document_mismatch: 'Information does not match our records',
  incomplete_submission: 'Required documents are missing',
  suspicious_activity: 'Verification failed due to suspicious activity',
  address_mismatch: 'Address on documents does not match',
};

// ============================================================================
// KYCService Class
// ============================================================================

class KYCServiceClass {
  /**
   * Check KYC status for a retailer
   * Requirements 4.4, 4.9: Check KYC status and display rejection reasons
   * 
   * Property 15: KYC Gate Enforcement
   * For any credit facility access attempt where kyc_status != 'verified',
   * the system SHALL redirect to KYC flow and block payment initiation.
   */
  async checkKYCStatus(retailerId: string): Promise<KYCStatusResult> {
    const facility = await CreditService.getCreditFacility(retailerId);
    
    if (!facility) {
      // No credit facility exists - create one and return pending status
      await CreditService.getOrCreateCreditFacility(retailerId);
      return {
        status: 'pending',
        isVerified: false,
        canAccessCredit: false,
        pendingDocuments: KYC_REQUIREMENTS.filter(r => r.required).map(r => r.displayName),
        nextSteps: [
          'Complete your KYC verification to access credit facilities',
          'Upload required documents: Aadhaar, PAN, Shop License, Bank Statement',
        ],
      };
    }

    const isVerified = facility.kyc_status === 'verified';
    const pendingDocuments = isVerified ? [] : await this.getPendingDocuments(retailerId);
    
    return {
      status: facility.kyc_status,
      isVerified,
      canAccessCredit: isVerified,
      rejectionReason: facility.kyc_rejection_reason,
      pendingDocuments,
      verifiedAt: facility.kyc_verified_at,
      creditLimit: isVerified ? facility.credit_limit : undefined,
      nextSteps: this.getNextSteps(facility.kyc_status, facility.kyc_rejection_reason),
    };
  }

  /**
   * Check if user needs to complete KYC before accessing credit
   * Requirements 4.4: Redirect to KYC flow for unverified users
   */
  async requiresKYC(retailerId: string): Promise<{
    required: boolean;
    reason?: string;
    redirectTo?: string;
  }> {
    const status = await this.checkKYCStatus(retailerId);
    
    if (status.isVerified) {
      return { required: false };
    }

    let reason: string;
    let redirectTo: string;

    switch (status.status) {
      case 'pending':
        reason = 'Please complete KYC verification to access credit facilities';
        redirectTo = '/kyc/start';
        break;
      case 'rejected':
        reason = status.rejectionReason || 'KYC verification was rejected. Please resubmit.';
        redirectTo = '/kyc/resubmit';
        break;
      default:
        reason = 'KYC verification required';
        redirectTo = '/kyc/start';
    }

    return {
      required: true,
      reason,
      redirectTo,
    };
  }

  /**
   * Get list of pending/missing documents
   */
  async getPendingDocuments(retailerId: string): Promise<string[]> {
    // In a real implementation, this would check uploaded documents
    // For now, return all required documents as pending
    const { data: documents } = await supabase
      .from('kyc_documents')
      .select('document_type, status')
      .eq('retailer_id', retailerId);

    const uploadedTypes = new Set(
      (documents || [])
        .filter(d => d.status === 'verified' || d.status === 'pending')
        .map(d => d.document_type)
    );

    return KYC_REQUIREMENTS
      .filter(r => r.required && !uploadedTypes.has(r.documentType))
      .map(r => r.displayName);
  }

  /**
   * Get next steps based on KYC status
   */
  private getNextSteps(status: KycStatus, rejectionReason?: string): string[] {
    switch (status) {
      case 'pending':
        return [
          'Upload all required documents',
          'Ensure documents are clear and readable',
          'Wait for verification (usually 24-48 hours)',
        ];
      case 'rejected':
        const steps = ['Review the rejection reason below'];
        if (rejectionReason) {
          const friendlyReason = KYC_REJECTION_REASONS[rejectionReason] || rejectionReason;
          steps.push(`Issue: ${friendlyReason}`);
        }
        steps.push('Resubmit corrected documents');
        return steps;
      case 'verified':
        return ['Your KYC is complete. You can now use credit facilities.'];
      default:
        return ['Contact support for assistance'];
    }
  }

  /**
   * Submit KYC documents
   * Requirements 4.5: Update retailer's credit eligibility status
   */
  async submitKYCDocuments(
    retailerId: string,
    documents: Array<{ type: string; url: string }>
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Insert documents
      const { error: docError } = await supabase
        .from('kyc_documents')
        .upsert(
          documents.map(doc => ({
            retailer_id: retailerId,
            document_type: doc.type,
            document_url: doc.url,
            status: 'pending',
            uploaded_at: new Date().toISOString(),
          })),
          { onConflict: 'retailer_id,document_type' }
        );

      if (docError) {
        console.error('[KYCService] Error submitting documents:', docError);
        return { success: false, message: 'Failed to submit documents' };
      }

      // Update credit facility status to pending (if it was rejected)
      const facility = await CreditService.getCreditFacility(retailerId);
      if (facility && facility.kyc_status === 'rejected') {
        await supabase
          .from('credit_facilities')
          .update({
            kyc_status: 'pending',
            kyc_rejection_reason: null,
          })
          .eq('retailer_id', retailerId);
      }

      return {
        success: true,
        message: 'Documents submitted successfully. Verification usually takes 24-48 hours.',
      };
    } catch (error) {
      console.error('[KYCService] Error in submitKYCDocuments:', error);
      return { success: false, message: 'An error occurred while submitting documents' };
    }
  }

  /**
   * Update KYC status (admin function)
   * Requirements 4.5: Update retailer's credit eligibility status
   */
  async updateKYCStatus(
    retailerId: string,
    status: KycStatus,
    options?: {
      rejectionReason?: string;
      creditLimit?: number;
    }
  ): Promise<{ success: boolean }> {
    try {
      const updateData: Record<string, any> = {
        kyc_status: status,
      };

      if (status === 'verified') {
        updateData.kyc_verified_at = new Date().toISOString();
        updateData.kyc_rejection_reason = null;
        if (options?.creditLimit) {
          updateData.credit_limit = options.creditLimit;
          updateData.available_credit = options.creditLimit;
        }
      } else if (status === 'rejected') {
        updateData.kyc_rejection_reason = options?.rejectionReason || 'Verification failed';
        updateData.kyc_verified_at = null;
      }

      const { error } = await supabase
        .from('credit_facilities')
        .update(updateData)
        .eq('retailer_id', retailerId);

      if (error) {
        console.error('[KYCService] Error updating KYC status:', error);
        return { success: false };
      }

      return { success: true };
    } catch (error) {
      console.error('[KYCService] Error in updateKYCStatus:', error);
      return { success: false };
    }
  }

  /**
   * Get KYC requirements list
   */
  getRequirements(): KYCRequirement[] {
    return KYC_REQUIREMENTS;
  }

  /**
   * Get human-readable status message
   */
  getStatusMessage(status: KycStatus): string {
    return KYC_STATUS_MESSAGES[status];
  }

  /**
   * Get human-readable rejection reason
   */
  getRejectionReasonMessage(reason: string): string {
    return KYC_REJECTION_REASONS[reason] || reason;
  }
}

// Export singleton instance
export const KYCService = new KYCServiceClass();

// Export class for testing
export { KYCServiceClass };
