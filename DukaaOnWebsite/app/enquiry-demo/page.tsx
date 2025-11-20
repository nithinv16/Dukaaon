'use client';

import { PageLayout } from '@/components/layout';
import { EnquiryForm } from '@/components/forms';
import { useState } from 'react';

export default function EnquiryDemoPage() {
  const [showSuccess, setShowSuccess] = useState(false);

  return (
    <PageLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-neutral-light py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-heading font-bold text-primary-dark mb-4">
              Enquiry Form Demo
            </h1>
            <p className="text-lg text-primary-gray">
              Test the enquiry form implementation with different scenarios
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Seller Enquiry */}
            <div className="bg-white rounded-lg p-8 shadow-sm">
              <h2 className="text-2xl font-heading font-semibold text-primary-dark mb-6">
                Seller Enquiry Form
              </h2>
              <EnquiryForm
                sellerId="demo-seller-123"
                sellerName="Demo Wholesaler"
                enquiryType="seller"
                onSuccess={() => {
                  setShowSuccess(true);
                  setTimeout(() => setShowSuccess(false), 3000);
                }}
                showCancelButton={true}
                onCancel={() => alert('Cancel clicked')}
              />
            </div>

            {/* General Contact */}
            <div className="bg-white rounded-lg p-8 shadow-sm">
              <h2 className="text-2xl font-heading font-semibold text-primary-dark mb-6">
                General Contact Form
              </h2>
              <EnquiryForm
                enquiryType="contact"
                onSuccess={() => {
                  setShowSuccess(true);
                  setTimeout(() => setShowSuccess(false), 3000);
                }}
              />
            </div>
          </div>

          {/* Success Toast */}
          {showSuccess && (
            <div className="fixed bottom-4 right-4 bg-secondary-green text-white px-6 py-4 rounded-lg shadow-lg animate-fade-in">
              Form submitted successfully!
            </div>
          )}

          {/* Testing Instructions */}
          <div className="mt-12 bg-white rounded-lg p-8 shadow-sm">
            <h2 className="text-2xl font-heading font-semibold text-primary-dark mb-4">
              Testing Instructions
            </h2>
            <div className="space-y-4 text-primary-gray">
              <div>
                <h3 className="font-semibold text-primary-dark mb-2">Test Validation:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Try submitting with empty fields</li>
                  <li>Enter invalid email (e.g., &quot;test&quot;)</li>
                  <li>Enter invalid phone (e.g., &quot;123&quot;)</li>
                  <li>Enter message less than 10 characters</li>
                  <li>Enter message more than 1000 characters</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-primary-dark mb-2">Test Valid Submission:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Name: John Doe</li>
                  <li>Email: john@example.com</li>
                  <li>Phone: +91 98765 43210 or 9876543210</li>
                  <li>Location: Mumbai, Maharashtra</li>
                  <li>Message: At least 10 characters describing your enquiry</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-primary-dark mb-2">Expected Behavior:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Real-time validation on field blur</li>
                  <li>Character count updates as you type in message field</li>
                  <li>Submit button shows loading state during submission</li>
                  <li>Success message appears after successful submission</li>
                  <li>Form clears automatically after success</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
