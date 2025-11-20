'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Select, SelectOption } from '@/components/ui/Select';
import { InquiryData } from '@/types';
import { validateInquiryForm, getFieldError, ValidationError } from '@/lib/validation';
import { useInquirySubmission } from '@/hooks/useInquirySubmission';
import { trackInquirySubmission } from '@/lib/analytics';
import { CheckCircle, AlertCircle } from 'lucide-react';

export interface EnquiryFormProps {
  sellerId?: string;
  sellerName?: string;
  enquiryType?: 'seller' | 'general' | 'contact';
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancelButton?: boolean;
}

const MAX_MESSAGE_LENGTH = 1000;

// Stakeholder type options for contact form
const STAKEHOLDER_OPTIONS: SelectOption[] = [
  { value: 'investor', label: 'Investor' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'wholesaler', label: 'Wholesaler' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'fmcg', label: 'FMCG Company' },
  { value: 'other', label: 'Other' },
];

export function EnquiryForm({
  sellerId,
  sellerName,
  enquiryType = 'seller',
  onSuccess,
  onCancel,
  showCancelButton = false,
}: EnquiryFormProps) {
  // Form state
  const [formData, setFormData] = useState<Partial<InquiryData>>({
    visitorName: '',
    email: '',
    phone: '',
    location: '',
    message: '',
    sellerId: sellerId,
    enquiryType: enquiryType,
    stakeholderType: undefined,
  });

  // Validation state
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Submission hook
  const { status, error: submissionError, submitInquiry } = useInquirySubmission();

  // Update sellerId if it changes
  useEffect(() => {
    if (sellerId) {
      setFormData(prev => ({ ...prev, sellerId }));
    }
  }, [sellerId]);

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error for this field when user starts typing
    if (touched[name]) {
      const newErrors = errors.filter(err => err.field !== name);
      setErrors(newErrors);
    }
  };

  // Handle field blur (for validation)
  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    // Validate the specific field
    const validationResult = validateInquiryForm(formData);
    const fieldError = validationResult.errors.find(err => err.field === field);

    if (fieldError) {
      setErrors(prev => {
        const filtered = prev.filter(err => err.field !== field);
        return [...filtered, fieldError];
      });
    } else {
      setErrors(prev => prev.filter(err => err.field !== field));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    const allTouched = Object.keys(formData).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {}
    );
    setTouched(allTouched);

    // Validate form
    const validationResult = validateInquiryForm(formData);

    if (!validationResult.isValid) {
      setErrors(validationResult.errors);
      return;
    }

    // Submit form
    const success = await submitInquiry(formData as InquiryData);

    if (success) {
      // Track successful submission
      trackInquirySubmission(enquiryType, sellerId);

      // Clear form after successful submission
      setFormData({
        visitorName: '',
        email: '',
        phone: '',
        location: '',
        message: '',
        sellerId: sellerId,
        enquiryType: enquiryType,
        stakeholderType: undefined,
      });
      setTouched({});
      setErrors([]);

      // Call onSuccess callback after a short delay to show success message
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    }
  };

  // Get error message for a field
  const getError = (field: string): string | undefined => {
    if (!touched[field]) return undefined;
    return getFieldError(errors, field) || undefined;
  };

  // Show success message
  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-16 h-16 bg-secondary-green bg-opacity-10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-secondary-green" />
        </div>
        <h3 className="text-2xl font-heading font-semibold text-primary-dark mb-2">
          Enquiry Submitted Successfully!
        </h3>
        <p className="text-base text-primary-gray max-w-md">
          Thank you for your interest{sellerName ? ` in ${sellerName}` : ''}. We will get back to you
          shortly with the information you requested.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Show submission error if any */}
      {status === 'error' && submissionError && (
        <div className="flex items-start space-x-3 p-4 bg-accent-red bg-opacity-10 border border-accent-red rounded-lg">
          <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-accent-red">Failed to submit enquiry</p>
            <p className="text-sm text-accent-red mt-1">{submissionError}</p>
          </div>
        </div>
      )}

      {/* Enquiry context message */}
      {sellerName && (
        <div className="bg-primary-orange bg-opacity-5 border border-primary-orange border-opacity-20 rounded-lg p-4">
          <p className="text-sm text-primary-gray">
            You are enquiring about <span className="font-semibold text-primary-dark">{sellerName}</span>
          </p>
        </div>
      )}

      {/* Name Field */}
      <div>
        <label htmlFor="visitorName" className="block text-sm font-medium text-primary-dark mb-2">
          Your Name <span className="text-accent-red">*</span>
        </label>
        <Input
          id="visitorName"
          name="visitorName"
          type="text"
          placeholder="Enter your full name"
          value={formData.visitorName}
          onChange={handleChange}
          onBlur={() => handleBlur('visitorName')}
          error={getError('visitorName')}
          disabled={status === 'submitting'}
          required
        />
      </div>

      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-primary-dark mb-2">
          Email Address <span className="text-accent-red">*</span>
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="your.email@example.com"
          value={formData.email}
          onChange={handleChange}
          onBlur={() => handleBlur('email')}
          error={getError('email')}
          disabled={status === 'submitting'}
          required
        />
      </div>

      {/* Phone Field */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-primary-dark mb-2">
          Phone Number <span className="text-accent-red">*</span>
        </label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+91 98765 43210"
          value={formData.phone}
          onChange={handleChange}
          onBlur={() => handleBlur('phone')}
          error={getError('phone')}
          helperText="Enter a valid Indian phone number"
          disabled={status === 'submitting'}
          required
        />
      </div>

      {/* Location Field */}
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-primary-dark mb-2">
          Your Location <span className="text-accent-red">*</span>
        </label>
        <Input
          id="location"
          name="location"
          type="text"
          placeholder="City, State"
          value={formData.location}
          onChange={handleChange}
          onBlur={() => handleBlur('location')}
          error={getError('location')}
          helperText="e.g., Mumbai, Maharashtra"
          disabled={status === 'submitting'}
          required
        />
      </div>

      {/* Stakeholder Type Field (only for contact form) */}
      {enquiryType === 'contact' && (
        <div>
          <label htmlFor="stakeholderType" className="block text-sm font-medium text-primary-dark mb-2">
            I am a <span className="text-accent-red">*</span>
          </label>
          <Select
            id="stakeholderType"
            name="stakeholderType"
            options={STAKEHOLDER_OPTIONS}
            placeholder="Select your stakeholder type"
            value={formData.stakeholderType || ''}
            onChange={handleChange}
            onBlur={() => handleBlur('stakeholderType')}
            error={getError('stakeholderType')}
            helperText="Help us understand how we can assist you"
            disabled={status === 'submitting'}
            required
          />
        </div>
      )}

      {/* Message Field */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-primary-dark mb-2">
          Your Message <span className="text-accent-red">*</span>
        </label>
        <Textarea
          id="message"
          name="message"
          placeholder="Please describe your enquiry in detail..."
          value={formData.message}
          onChange={handleChange}
          onBlur={() => handleBlur('message')}
          error={getError('message')}
          rows={6}
          showCharCount
          maxCharCount={MAX_MESSAGE_LENGTH}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={status === 'submitting'}
          required
        />
      </div>

      {/* Form Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={status === 'submitting'}
          disabled={status === 'submitting'}
          className="flex-1"
        >
          {status === 'submitting' ? 'Submitting...' : 'Submit Enquiry'}
        </Button>

        {showCancelButton && onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCancel}
            disabled={status === 'submitting'}
            className="flex-1 sm:flex-initial"
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Privacy Notice */}
      <p className="text-xs text-primary-gray text-center">
        By submitting this form, you agree to our privacy policy. We will only use your information
        to respond to your enquiry.
      </p>
    </form>
  );
}
