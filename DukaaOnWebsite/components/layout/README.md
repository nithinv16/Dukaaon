# Layout Components

This directory contains the core layout components for the DukaaOn website.

## Components

### Header (`Header.tsx`)
A responsive navigation header with:
- Fixed positioning with scroll-based styling
- Desktop navigation with active link highlighting
- Mobile hamburger menu with slide-down animation
- Smooth scroll to sections support
- Logo and branding
- CTA button to marketplace

**Features:**
- Responsive design (mobile & desktop)
- Active route highlighting
- Smooth scroll behavior
- Mobile menu with body scroll lock
- Accessibility support (ARIA labels)

### Footer (`Footer.tsx`)
A comprehensive footer with:
- Company information and logo
- Navigation links (Company, Stakeholders, Legal)
- Contact information (email, phone)
- Social media links
- App download buttons (Google Play, App Store)
- Copyright notice

**Features:**
- Multi-column responsive layout
- Icon support via lucide-react
- Hover effects on links
- Organized sections

### PageLayout (`PageLayout.tsx`)
A wrapper component that provides consistent page structure:
- Includes Header and Footer
- Main content area with proper spacing
- Flexible children rendering

**Usage:**
```tsx
import { PageLayout } from '@/components/layout';

export default function MyPage() {
  return (
    <PageLayout>
      <div>Your page content</div>
    </PageLayout>
  );
}
```

### SEO (`SEO.tsx`)
SEO utilities and structured data generators:
- `generateMetadata()` - Creates Next.js metadata objects
- `generateOrganizationSchema()` - JSON-LD for organization
- `generateBreadcrumbSchema()` - JSON-LD for breadcrumbs
- `generateLocalBusinessSchema()` - JSON-LD for seller profiles

**Features:**
- Open Graph tags
- Twitter Card tags
- Canonical URLs
- Structured data (JSON-LD)
- SEO-friendly defaults

### LoadingState (`LoadingState.tsx`)
Loading components:
- `LoadingState` - Full-page loading spinner
- `PageLoadingSkeleton` - Skeleton screen for page loading

## Usage Example

```tsx
// app/page.tsx
import { PageLayout } from '@/components/layout';

export default function Home() {
  return (
    <PageLayout>
      <div className="container mx-auto">
        <h1>Welcome to DukaaOn</h1>
      </div>
    </PageLayout>
  );
}
```

## Styling

All components use Tailwind CSS with the custom design system defined in `tailwind.config.ts`:
- Primary colors (orange, dark, gray)
- Secondary colors (blue, green)
- Neutral colors
- Accent colors
- Custom spacing and typography

## Accessibility

All components follow accessibility best practices:
- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation support
- Focus indicators
- Screen reader friendly

## Requirements Satisfied

- **Requirement 1.2**: Smooth scrolling and transitions
- **Requirement 1.5**: Consistent branding and responsive design
- **Requirement 12.1**: SEO meta tags and structured data
