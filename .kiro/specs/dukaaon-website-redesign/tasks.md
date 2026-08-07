# Implementation Plan

## Status Summary

**Completed:** Tasks 1-13, 15 (Core functionality, pages, components, API, SEO, Analytics)
**Remaining:** Task 14.2-14.3 (Code splitting, lazy loading, and caching strategies)

Note: Tasks 16-22 from the original plan have been removed as they are either:
- Already implemented as part of other tasks (accessibility, error handling, security, mobile responsiveness)
- Non-coding activities (testing, deployment, documentation) that should be done manually
- Better suited for separate workflows outside of spec implementation

## Implementation Notes

The website is fully functional with all core features implemented:
- ✅ Modern design system with Tailwind CSS
- ✅ All pages (Home, About, Marketplace, Seller Profile, Contact)
- ✅ Location-based seller discovery with maps
- ✅ Enquiry form system with database integration
- ✅ SEO optimization with structured data
- ✅ Google Analytics 4 integration
- ✅ Image optimization with WebP support
- ⏳ Code splitting and caching (remaining optimizations)

---

- [x] 1. Project Setup and Configuration





  - Initialize Next.js 14 project with TypeScript and App Router in DukaaOnWebsite directory
  - Configure Tailwind CSS with custom design system (colors, typography, spacing)
  - Set up Supabase client and environment variables
  - Install and configure required dependencies (Framer Motion, React Hook Form, Leaflet)
  - Configure ESLint, Prettier, and TypeScript strict mode
  - _Requirements: 1.1, 1.5, 11.5_

- [x] 2. Database Setup (Minimal - Only New Table)






  - [x] 2.1 Create enquiry_messages table

    - Write SQL migration for enquiry_messages table (ONLY new table needed)
    - Add indexes for seller_id, status, enquiry_type, and created_at fields
    - Configure RLS policies for public insert access
    - Test table creation in Supabase SQL Editor
    - _Requirements: 5.3, 5.4, 7.1_
  
  - [x] 2.2 Verify existing database structure


    - Confirm sellers table exists with required fields
    - Confirm products table exists
    - Document existing table schemas for reference
    - Test queries against existing tables
    - _Requirements: 3.4, 7.1, 7.2_
-

- [x] 3. Core Utilities and Hooks




  - [x] 3.1 Implement geolocation utilities


    - Create useGeolocation hook for browser geolocation API
    - Implement Haversine formula for distance calculation
    - Create fallback IP-based geolocation function
    - Add error handling for permission denied and timeout scenarios
    - _Requirements: 3.1, 3.2, 6.1, 6.5_
  
  - [x] 3.2 Create data fetching hooks


    - Implement useSellerData hook with location filtering
    - Create useInquirySubmission hook
    - Add loading and error states management
    - _Requirements: 3.3, 5.1, 7.1_
  
  - [x] 3.3 Build form validation utilities

    - Create validation schemas for inquiry form
    - Create validation schemas for contact form
    - Implement phone number and email validation
    - _Requirements: 5.2, 10.2_
-

- [x] 4. Design System and Shared Components





  - [x] 4.1 Create design system foundation

    - Set up Tailwind config with custom colors, fonts, and spacing
    - Create CSS variables for theme values
    - Build typography components (Heading, Text, Label)
    - _Requirements: 1.1, 1.5_
  

  - [x] 4.2 Build base UI components

    - Create Button component with variants (primary, secondary, outline)
    - Create Input component with validation states
    - Create Textarea component
    - Create Select/Dropdown component
    - Create Modal/Dialog component
    - Create Card component
    - _Requirements: 1.1, 5.1, 10.1_
  
  - [x] 4.3 Implement animation components


    - Create FadeIn animation wrapper
    - Create SlideIn animation wrapper
    - Create ScrollReveal component for scroll-triggered animations
    - Configure Framer Motion variants
    - _Requirements: 1.2, 8.5_
-

- [x] 5. Navigation and Layout Components




  - [x] 5.1 Build header/navigation component


    - Create responsive navigation with mobile menu
    - Implement smooth scroll to sections
    - Add active link highlighting
    - Include logo and branding
    - _Requirements: 1.2, 1.5_
  

  - [x] 5.2 Create footer component

    - Add company information and links
    - Include social media links
    - Add app download buttons
    - Implement newsletter signup (optional)
    - _Requirements: 1.5_
  

  - [x] 5.3 Build page layout wrapper

    - Create consistent page structure
    - Implement SEO meta tags component
    - Add loading states
    - _Requirements: 1.5, 12.1_

- [x] 6. Home Page Implementation






  - [x] 6.1 Create hero section


    - Build full-viewport hero with animated graphics
    - Implement parallax scrolling effect
    - Add call-to-action buttons
    - Optimize background images/videos
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 6.2 Build value proposition section


    - Create content layout for DukaaOn's core value
    - Add animated statistics/metrics
    - Implement scroll-triggered animations
    - _Requirements: 2.2, 8.3_
  
  - [x] 6.3 Implement features showcase section


    - Create feature cards with icons and descriptions
    - Add hover animations and interactions
    - Implement responsive grid layout
    - _Requirements: 2.2, 9.1, 9.2_
  
  - [x] 6.4 Build stakeholder benefits section


    - Create separate content blocks for each stakeholder type
    - Add visual representations (icons, illustrations)
    - Implement tabbed or accordion interface
    - _Requirements: 2.1, 2.2, 9.3_
  
  - [x] 6.5 Create problem-solution section


    - Display problem statement clearly
    - Show solution approach with visuals
    - Add infographics or diagrams
    - _Requirements: 2.3, 2.4_
-

- [x] 7. Marketplace Page Implementation




  - [x] 7.1 Build location permission flow


    - Create location request UI
    - Implement permission handling logic
    - Add manual location input fallback
    - Show loading states during location detection
    - _Requirements: 3.1, 3.2, 3.3, 6.1, 6.5_
  

  - [x] 7.2 Create seller listing grid

    - Build SellerCard component with all required information
    - Implement responsive grid layout
    - Add distance badges and category tags
    - Implement image lazy loading
    - _Requirements: 3.4, 3.5, 4.1, 4.2_
  

  - [x] 7.3 Implement filtering and search

    - Create filter UI for business type and categories
    - Add search input for business name
    - Implement radius adjustment slider
    - Update results dynamically on filter changes
    - _Requirements: 3.3, 3.4, 6.3_
  

  - [x] 7.4 Build map view component

    - Integrate Leaflet or Mapbox for interactive map
    - Add seller markers with clustering
    - Show radius circle around user location
    - Implement marker click to show seller popup
    - _Requirements: 3.4, 6.2, 6.3_
  

  - [x] 7.5 Handle empty states and errors

    - Create UI for no sellers found within radius
    - Add error messages for location failures
    - Implement retry mechanisms
    - _Requirements: 6.5, 7.4_

- [x] 8. Seller Profile Page Implementation




  - [x] 8.1 Create seller profile layout


    - Build page structure with seller information sections
    - Display business name, type, location, and description
    - Add breadcrumb navigation
    - _Requirements: 4.2, 4.3_
  
  - [x] 8.2 Implement product gallery


    - Create image gallery component with lightbox
    - Add image carousel/slider
    - Implement lazy loading for images
    - Ensure no prices are displayed
    - _Requirements: 4.3, 4.5_
  
  - [x] 8.3 Build location map section


    - Show seller location on embedded map
    - Display address information
    - Calculate and show distance from user
    - _Requirements: 4.2_
  
  - [x] 8.4 Create "Enquire Details" button and modal


    - Add prominent CTA button
    - Implement modal/slide-in for inquiry form
    - _Requirements: 4.4, 5.1_
- [x] 9. Enquiry Form Implementation






- [ ] 9. Enquiry Form Implementation


  - [x] 9.1 Build enquiry form UI

    - Create form with all required fields (name, email, phone, location, message)
    - Implement real-time validation
    - Add character count for message field
    - Style form according to design system
    - Support both seller enquiries and general contact
    - _Requirements: 5.1, 5.2, 10.1, 10.2_
  


  - [x] 9.2 Implement form submission logic


    - Connect form to /api/enquiry endpoint
    - Add loading states during submission
    - Handle success and error responses
    - Show confirmation message on success
    - Clear form after successful submission
    - _Requirements: 5.3, 5.4, 10.3, 10.4_

  
  - [x] 9.3 Add form validation and error handling

    - Validate email format
    - Validate phone number format (Indian format)
    - Ensure all required fields are filled
    - Display field-specific error messages
    - _Requirements: 5.2, 10.2_
-

- [x] 10. Contact Page Implementation










  - [x] 10.1 Create contact section

    - Reuse enquiry form component with enquiry_type='contact'
    - Add stakeholder type field (investor, retailer, wholesaler, manufacturer, FMCG)
    - Style according to design system
    - _Requirements: 10.1, 10.2_
  
  - [x] 10.2 Add company contact information


    - Display email: support@dukaaon.in
    - Display phone: +91-8086142552
    - Add office address (if available)
    - Include business hours
    - Add social media links

    - _Requirements: 10.1_

- [x] 11. API Routes Implementation





  - [x] 11.1 Create GET /api/sellers endpoint


    - Query existing sellers table from root app database
    - Implement distance calculation using Haversine formula
    - Add filtering by business type and category
    - Add pagination support
    - Return sellers sorted by distance
    - _Requirements: 3.3, 3.4, 6.2, 6.3, 6.4, 7.1_
  
  - [x] 11.2 Create POST /api/enquiry endpoint


    - Validate request body (name, email, phone, message)
    - Insert into enquiry_messages table
    - Send notification email to admin (optional)
    - Return success response with enquiry ID
    - Implement rate limiting to prevent spam
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 7.2, 10.2, 10.3, 10.4_
  
  - [x] 11.3 Create GET /api/geolocation endpoint


    - Implement IP-based geolocation as fallback
    - Return coordinates and location information
    - Handle API errors gracefully
    - _Requirements: 6.5_

- [x] 12. About Page Implementation




  - Create company story section with timeline or narrative
  - Build mission and vision sections
  - Add team information (if applicable)
  - Display market opportunity data with charts
  - Include problem statement and solution approach
  - _Requirements: 2.2, 2.3, 2.5_

- [x] 13. SEO and Meta Tags Implementation



  - [x] 13.1 Set up dynamic meta tags


    - Create reusable SEO component
    - Add page-specific titles and descriptions
    - Implement Open Graph tags for social sharing
    - Add Twitter Card tags
    - _Requirements: 12.1, 12.3_
  

  - [x] 13.2 Implement structured data

    - Add JSON-LD for Organization
    - Add JSON-LD for LocalBusiness (for sellers)
    - Implement breadcrumb structured data
    - _Requirements: 12.2_
  

  - [x] 13.3 Create sitemap and robots.txt

    - Generate dynamic sitemap.xml
    - Configure robots.txt for proper crawling
    - Add canonical URLs to all pages
    - _Requirements: 12.4, 12.5_

- [x] 14. Performance Optimization



  - [x] 14.1 Optimize images
    - Convert images to WebP format
    - Implement responsive images with next/image
    - Add blur placeholders for loading states
    - Compress all images
    - _Requirements: 1.4, 11.3_
  
  - [x] 14.2 Implement code splitting and lazy loading




    - Lazy load non-critical components (map, modals, forms)
    - Use React.lazy() and Suspense for heavy components
    - Implement dynamic imports for route-based code splitting
    - Prefetch critical routes using Next.js Link prefetch
    - _Requirements: 1.4_
  
  - [x] 14.3 Add caching strategies




    - Configure API response caching with Next.js revalidate
    - Implement stale-while-revalidate for seller data API
    - Add Cache-Control headers to API routes
    - Configure browser caching for static assets
    - _Requirements: 1.4_
-

- [x] 15. Analytics Integration





  - [x] 15.1 Set up Google Analytics 4


    - Create GA4 property in Google Analytics
    - Add GA4 tracking script to root layout
    - Configure page view tracking
    - Set up custom events for key interactions
    - _Requirements: 13.1, 13.2_
  
  - [x] 15.2 Implement conversion tracking


    - Track inquiry form submissions
    - Track contact form submissions
    - Track seller profile views
    - Track "Enquire Details" button clicks
    - Track marketplace filter usage
    - _Requirements: 13.3, 13.4_
  
  - [x] 15.3 Add geographic tracking


    - Track visitor locations
    - Analyze seller discovery patterns
    - Monitor marketplace usage by region
    - _Requirements: 13.5_
