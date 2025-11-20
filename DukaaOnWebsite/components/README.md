# DukaaOn Design System Components

This directory contains all reusable UI components and animations for the DukaaOn website.

## Directory Structure

```
components/
├── ui/                    # Base UI components
│   ├── Typography/        # Text components (Heading, Text, Label)
│   ├── Button.tsx         # Button component with variants
│   ├── Input.tsx          # Input field with validation
│   ├── Textarea.tsx       # Textarea with character count
│   ├── Select.tsx         # Dropdown select component
│   ├── Modal.tsx          # Modal/Dialog component
│   ├── Card.tsx           # Card component with variants
│   └── index.ts           # Barrel export
├── animations/            # Animation components
│   ├── FadeIn.tsx         # Fade in animation wrapper
│   ├── SlideIn.tsx        # Slide in animation wrapper
│   ├── ScrollReveal.tsx   # Scroll-triggered animations
│   ├── variants.ts        # Framer Motion variants
│   └── index.ts           # Barrel export
└── index.ts               # Main barrel export
```

## Usage

### Typography Components

```tsx
import { Heading, Text, Label } from '@/components';

// Headings
<Heading as="h1" variant="h1">Main Title</Heading>
<Heading as="h2" variant="h3">Smaller heading with h2 tag</Heading>

// Text
<Text size="lg" weight="bold" color="primary">
  Large bold text
</Text>

// Labels
<Label required>Field Name</Label>
<Label error>Error Label</Label>
```

### Form Components

```tsx
import { Button, Input, Textarea, Select } from '@/components';

// Button
<Button variant="primary" size="md" onClick={handleClick}>
  Click Me
</Button>
<Button variant="outline" isLoading>
  Loading...
</Button>

// Input
<Input
  placeholder="Enter text"
  error="This field is required"
  helperText="Helper text"
/>

// Textarea
<Textarea
  placeholder="Enter message"
  showCharCount
  maxCharCount={200}
/>

// Select
<Select
  options={[
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' }
  ]}
  placeholder="Select option"
/>
```

### Layout Components

```tsx
import { Card, CardHeader, CardBody, CardFooter, Modal } from '@/components';

// Card
<Card variant="elevated" hoverable>
  <CardHeader>
    <Heading as="h3" variant="h4">Card Title</Heading>
  </CardHeader>
  <CardBody>
    <Text>Card content goes here</Text>
  </CardBody>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

// Modal
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Modal Title"
  size="md"
>
  <Text>Modal content</Text>
</Modal>
```

### Animation Components

```tsx
import { FadeIn, SlideIn, ScrollReveal } from '@/components';

// Fade In (triggers on mount)
<FadeIn delay={0.2} duration={0.6} direction="up">
  <div>Content fades in</div>
</FadeIn>

// Slide In (triggers on mount)
<SlideIn direction="left" distance={50}>
  <div>Content slides in</div>
</SlideIn>

// Scroll Reveal (triggers on scroll)
<ScrollReveal direction="up" threshold={0.2} once>
  <div>Content reveals on scroll</div>
</ScrollReveal>
```

### Using Animation Variants

```tsx
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer, staggerItem } from '@/components';

// Direct variant usage
<motion.div variants={fadeInUp} initial="hidden" animate="visible">
  Content
</motion.div>

// Stagger children
<motion.div variants={staggerContainer} initial="hidden" animate="visible">
  <motion.div variants={staggerItem}>Item 1</motion.div>
  <motion.div variants={staggerItem}>Item 2</motion.div>
  <motion.div variants={staggerItem}>Item 3</motion.div>
</motion.div>
```

## Component Props

### Button Props
- `variant`: 'primary' | 'secondary' | 'outline'
- `size`: 'sm' | 'md' | 'lg'
- `isLoading`: boolean
- `disabled`: boolean

### Input/Textarea Props
- `error`: string (error message)
- `helperText`: string
- `showCharCount`: boolean (Textarea only)
- `maxCharCount`: number (Textarea only)

### Card Props
- `variant`: 'default' | 'elevated' | 'outlined'
- `padding`: 'none' | 'sm' | 'md' | 'lg'
- `hoverable`: boolean

### Modal Props
- `isOpen`: boolean
- `onClose`: () => void
- `title`: string
- `size`: 'sm' | 'md' | 'lg' | 'xl'
- `showCloseButton`: boolean

### Animation Props
- `delay`: number (seconds)
- `duration`: number (seconds)
- `direction`: 'up' | 'down' | 'left' | 'right' | 'none'
- `distance`: number (pixels, for slide animations)
- `threshold`: number (0-1, for scroll reveal)
- `once`: boolean (animate only once)

## Design Tokens

### Colors
- Primary: `primary-orange`, `primary-dark`, `primary-gray`
- Secondary: `secondary-blue`, `secondary-green`
- Neutral: `neutral-white`, `neutral-light`, `neutral-medium`, `neutral-dark`
- Accent: `accent-yellow`, `accent-red`

### Typography
- Font Families: `font-heading`, `font-body`
- Sizes: `text-xs` to `text-6xl`
- Weights: `font-normal`, `font-medium`, `font-semibold`, `font-bold`

### Spacing
- Scale: `space-1` (4px) to `space-24` (96px)

## Demo Page

Visit `/components-demo` to see all components in action with interactive examples.

## Best Practices

1. **Consistency**: Always use design system components instead of creating custom ones
2. **Accessibility**: All components include proper ARIA labels and keyboard navigation
3. **Responsive**: Components are mobile-first and responsive by default
4. **Performance**: Use `ScrollReveal` for animations that should trigger on scroll
5. **Type Safety**: All components are fully typed with TypeScript

## Adding New Components

When adding new components:
1. Create the component in the appropriate directory (`ui/` or `animations/`)
2. Export it from the directory's `index.ts`
3. Add documentation to this README
4. Add examples to the demo page
5. Ensure TypeScript types are properly defined
6. Follow existing naming conventions and patterns
