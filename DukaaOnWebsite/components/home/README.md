# Home Page Components

This directory contains all the components used on the DukaaOn website home page.

## Components

### HeroSection
The main hero section with full-viewport height, animated graphics, and parallax scrolling effects.

**Features:**
- Parallax scrolling background elements
- Animated gradient text
- Call-to-action buttons
- Statistics display
- Scroll indicator

**Requirements:** 8.1, 8.2, 8.3, 8.4, 8.5

---

### ValuePropositionSection
Showcases DukaaOn's core value proposition with animated metrics and impact statistics.

**Features:**
- Animated metric cards with hover effects
- Scroll-triggered animations
- Core value proposition highlight box
- Feature tags

**Requirements:** 2.2, 8.3

---

### FeaturesSection
Displays platform features in a responsive grid with icons and descriptions.

**Features:**
- 6 feature cards with gradient icons
- Hover animations and lift effects
- Benefits list for each feature
- Responsive grid layout (1/2/3 columns)

**Requirements:** 2.2, 9.1, 9.2

**Features Included:**
1. AI-Powered Supply Chain
2. Micro-Warehousing Network
3. Credit Facilities
4. Stock Sharing
5. Voice-Based Ordering
6. Regional Language Support

---

### StakeholderBenefitsSection
Tabbed interface showing benefits for different stakeholder types.

**Features:**
- Tab navigation for 5 stakeholder types
- Animated content transitions
- Benefit cards with icons
- Responsive layout

**Requirements:** 2.1, 2.2, 9.3

**Stakeholder Types:**
1. Retailers
2. Wholesalers
3. Manufacturers
4. FMCG Companies
5. Investors

---

### ProblemSolutionSection
Side-by-side comparison of problems and solutions with visual flow diagram.

**Features:**
- Problem cards with statistics
- Solution cards with gradient backgrounds
- "How DukaaOn Works" flow diagram
- 4-step process visualization

**Requirements:** 2.3, 2.4

---

### NearbySellersSection
Displays nearby wholesalers or manufacturers based on user location.

**Features:**
- Location-based seller discovery
- Shows top 3 nearest sellers
- Distance calculation and display
- Location permission prompt
- Loading and empty states
- Links to marketplace and seller profiles

**Props:**
- `businessType`: 'wholesaler' | 'manufacturer'
- `title`: Section heading
- `description`: Section description

**Requirements:** 3.1, 3.2, 3.3

---

## Usage

All components are exported from the index file:

```typescript
import {
  HeroSection,
  ValuePropositionSection,
  FeaturesSection,
  StakeholderBenefitsSection,
  ProblemSolutionSection,
  NearbySellersSection,
} from '@/components/home';
```

## Animations

All components use Framer Motion for animations:
- Scroll-triggered animations with `useInView`
- Stagger animations for lists
- Hover effects for interactive elements
- Parallax effects in hero section

## Styling

Components use:
- Tailwind CSS utility classes
- Custom CSS variables from design system
- Gradient backgrounds
- Responsive breakpoints (mobile, tablet, desktop)

## Performance

- Components use `useInView` with `once: true` to prevent re-animation
- Images should be optimized with next/image
- Animations are GPU-accelerated
- Lazy loading for off-screen content
