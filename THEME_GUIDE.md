# Dukaaon App Theme Guide

This guide outlines the consistent theme and styling approach for the Dukaaon app.

## Color Palette

All colors are defined as constants in `constants/theme.ts` and should be imported from there:

```typescript
import { COLORS } from '../constants/theme';
```

### Primary Colors
- **White** (`COLORS.white`): `#FFFFFF` - Primary background color
- **Off-White** (`COLORS.offWhite`): `#F5F5F5` - Secondary background, form fields
- **Orange** (`COLORS.orange`): `#FF7D00` - Primary action color (buttons, CTAs)
- **Light Orange** (`COLORS.lightOrange`): `#FFAB58` - Highlights, secondary actions
- **Dark Blue Grey** (`COLORS.darkBlueGrey`): `#37474F` - Headings, important text
- **Grey** (`COLORS.grey`): `#808080` - Secondary text, inactive elements
- **Light Grey** (`COLORS.lightGrey`): `#E0E0E0` - Borders, dividers, backgrounds

### Utility Colors
- **Error** (`COLORS.error`): `#FF3B30` - Error messages, destructive actions
- **Success** (`COLORS.success`): `#4CAF50` - Success messages, confirmations
- **Info** (`COLORS.info`): `#2196F3` - Information, links

## Screen Types and Background Colors

1. **Main Content Screens**
   - Background: `COLORS.white`
   - Content containers: `COLORS.white` with light elevation
   - Dividers: `COLORS.lightGrey`

2. **Detail Screens**
   - Same as main content screens
   - Featured content can use `COLORS.offWhite` background

3. **Form Screens**
   - Background: `COLORS.white`
   - Input fields: `COLORS.offWhite`

## Common Elements

### Buttons
- **Primary Buttons**
  - Background: `COLORS.orange`
  - Text: `COLORS.white`
  - Pressed state: `COLORS.lightOrange`

- **Secondary Buttons**
  - Background: `COLORS.darkBlueGrey`
  - Text: `COLORS.white`

- **Outline Buttons**
  - Border: `COLORS.orange`
  - Text: `COLORS.orange`
  - Background: Transparent

### Cards
- Background: `COLORS.white` 
- Elevation: 2
- Border radius: 8px
- Shadows/elevation using theme elevation levels

### Typography
- Headings: `COLORS.darkBlueGrey`
- Body text: `COLORS.black`
- Secondary text: `COLORS.grey`
- Action/interactive text: `COLORS.orange`
- Links: `COLORS.info`

### Form Elements
- Input backgrounds: `COLORS.offWhite`
- Placeholders: `COLORS.grey`
- Borders/dividers: `COLORS.lightGrey`
- Active state: `COLORS.orange`

## Implementation

### New Features
When creating new screens or components, always:
1. Import colors from the constants: `import { COLORS } from '../constants/theme';`
2. Use those color constants in styles
3. Follow the guidelines for the specific screen type
4. Match the overall theme aesthetic

### Existing Features
As you update existing screens and components, gradually migrate them to use:
1. Colors from the theme constants
2. Consistent styling patterns as defined in this guide

By following these guidelines, we'll ensure a consistent, professional look across the entire app. 