'use client';

import { useState, useCallback } from 'react';
import { InquiryData } from '@/types';

export type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface UseInquirySubmissionReturn {
  status: SubmissionStatus;
  error: string | null;
  enquiryId: string | null;
  submitInquiry: (data: InquiryData) => Promise<boolean>;
  reset: () => void;
}

/**
 * Hook for submitting inquiry forms
 * @returns Inquiry submission state and control functions
 */
export function useInquirySubmission(): UseInquirySubmissionReturn {
  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [enquiryId, setEnquiryId] = useState<string | null>(null);

  const submitInquiry = useCallback(async (data: InquiryData): Promise<boolean> => {
    setStatus('submitting');
    setError(null);
    setEnquiryId(null);

    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit inquiry');
      }

      setEnquiryId(result.data?.enquiryId || null);
      setStatus('success');
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to submit inquiry';
      setError(errorMessage);
      setStatus('error');
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setEnquiryId(null);
  }, []);

  return {
    status,
    error,
    enquiryId,
    submitInquiry,
    reset,
  };
}
