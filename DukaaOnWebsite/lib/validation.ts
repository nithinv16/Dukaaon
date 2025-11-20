import { InquiryData } from '@/types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns True if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate Indian phone number format
 * Accepts formats: 10 digits, +91 followed by 10 digits, or with spaces/dashes
 * @param phone - Phone number to validate
 * @returns True if valid, false otherwise
 */
export function isValidIndianPhone(phone: string): boolean {
  // Remove all spaces, dashes, and parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  // Check for valid Indian phone number patterns
  const patterns = [
    /^[6-9]\d{9}$/, // 10 digits starting with 6-9
    /^\+91[6-9]\d{9}$/, // +91 followed by 10 digits
    /^91[6-9]\d{9}$/, // 91 followed by 10 digits
  ];
  
  return patterns.some(pattern => pattern.test(cleaned));
}

/**
 * Validate phone number (international format)
 * @param phone - Phone number to validate
 * @returns True if valid, false otherwise
 */
export function isValidPhone(phone: string): boolean {
  // Remove all spaces, dashes, and parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  // Check for valid phone number (10-15 digits, optionally starting with +)
  const phoneRegex = /^\+?[1-9]\d{9,14}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validate required field
 * @param value - Value to validate
 * @param minLength - Minimum length (optional)
 * @returns True if valid, false otherwise
 */
export function isRequired(value: string, minLength = 1): boolean {
  return value.trim().length >= minLength;
}

/**
 * Validate inquiry form data
 * @param data - Inquiry form data
 * @returns Validation result with errors
 */
export function validateInquiryForm(data: Partial<InquiryData>): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate visitor name
  if (!data.visitorName || !isRequired(data.visitorName, 2)) {
    errors.push({
      field: 'visitorName',
      message: 'Name must be at least 2 characters long',
    });
  }

  // Validate email
  if (!data.email || !isRequired(data.email)) {
    errors.push({
      field: 'email',
      message: 'Email is required',
    });
  } else if (!isValidEmail(data.email)) {
    errors.push({
      field: 'email',
      message: 'Please enter a valid email address',
    });
  }

  // Validate phone
  if (!data.phone || !isRequired(data.phone)) {
    errors.push({
      field: 'phone',
      message: 'Phone number is required',
    });
  } else if (!isValidIndianPhone(data.phone) && !isValidPhone(data.phone)) {
    errors.push({
      field: 'phone',
      message: 'Please enter a valid phone number',
    });
  }

  // Validate location
  if (!data.location || !isRequired(data.location, 2)) {
    errors.push({
      field: 'location',
      message: 'Location must be at least 2 characters long',
    });
  }

  // Validate message
  if (!data.message || !isRequired(data.message, 10)) {
    errors.push({
      field: 'message',
      message: 'Message must be at least 10 characters long',
    });
  } else if (data.message.length > 1000) {
    errors.push({
      field: 'message',
      message: 'Message must not exceed 1000 characters',
    });
  }

  // Validate enquiry type
  if (data.enquiryType && !['seller', 'general', 'contact'].includes(data.enquiryType)) {
    errors.push({
      field: 'enquiryType',
      message: 'Invalid enquiry type',
    });
  }

  // Validate stakeholder type for contact forms
  if (data.enquiryType === 'contact') {
    if (!data.stakeholderType) {
      errors.push({
        field: 'stakeholderType',
        message: 'Please select your stakeholder type',
      });
    } else {
      const validStakeholderTypes = ['investor', 'retailer', 'wholesaler', 'manufacturer', 'fmcg', 'other'];
      if (!validStakeholderTypes.includes(data.stakeholderType)) {
        errors.push({
          field: 'stakeholderType',
          message: 'Please select a valid stakeholder type',
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate contact form data
 * @param data - Contact form data
 * @returns Validation result with errors
 */
export function validateContactForm(data: Partial<InquiryData>): ValidationResult {
  // Contact form uses the same validation as inquiry form
  // but enquiry type is always 'contact'
  const contactData = {
    ...data,
    enquiryType: 'contact' as const,
  };
  
  const result = validateInquiryForm(contactData);
  
  // Additional validation for stakeholder type in contact forms
  if (data.enquiryType === 'contact' && data.stakeholderType) {
    const validStakeholderTypes = ['investor', 'retailer', 'wholesaler', 'manufacturer', 'fmcg', 'other'];
    if (!validStakeholderTypes.includes(data.stakeholderType)) {
      result.errors.push({
        field: 'stakeholderType',
        message: 'Please select a valid stakeholder type',
      });
      result.isValid = false;
    }
  }
  
  return result;
}

/**
 * Get error message for a specific field
 * @param errors - Array of validation errors
 * @param field - Field name
 * @returns Error message or null
 */
export function getFieldError(errors: ValidationError[], field: string): string | null {
  const error = errors.find(err => err.field === field);
  return error ? error.message : null;
}

/**
 * Sanitize user input to prevent XSS
 * @param input - User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > characters
    .substring(0, 1000); // Limit length
}

/**
 * Format phone number for display
 * @param phone - Phone number
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  // Format Indian numbers
  if (cleaned.startsWith('+91')) {
    const number = cleaned.substring(3);
    return `+91 ${number.substring(0, 5)} ${number.substring(5)}`;
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    const number = cleaned.substring(2);
    return `+91 ${number.substring(0, 5)} ${number.substring(5)}`;
  } else if (cleaned.length === 10) {
    return `${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
  }
  
  return phone;
}
