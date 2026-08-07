# Category and Subcategory Translation Guide

This guide explains how the dynamic category and subcategory translation system works in the DukaaOn app and how to add new translations.

## Overview

The translation system is designed to handle categories and subcategories dynamically, supporting both predefined mappings and automatic key generation for new items from the Supabase database.

## Architecture

### Core Files

1. **`utils/categoryTranslation.ts`** - Central translation logic
2. **`hooks/useCategoryTranslation.ts`** - React hook for components
3. **`contexts/LanguageContext.tsx`** - Translation keys storage
4. **`app/(main)/screens/category/[id].tsx`** - Implementation example

### Key Components

#### 1. Translation Key Generation
```typescript
const generateTranslationKey = (text: string, isCategory: boolean = false): string => {
  const prefix = isCategory ? 'categories' : 'subcategories';
  const key = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/&/g, 'and'); // Replace & with 'and'
  return `${prefix}.${key}`;
};
```

#### 2. Predefined Mappings
The system includes predefined mappings for common categories and subcategories to ensure consistent translations.

#### 3. Dynamic Translation
For new items from the database, the system automatically generates translation keys and falls back to the original text if no translation is found.

## Usage

### In React Components

```typescript
import { useCategoryTranslation } from '@/hooks/useCategoryTranslation';

const MyComponent = () => {
  const { translateCategoryOrSubcategory, translateMultiple } = useCategoryTranslation();
  
  // Translate a single category
  const categoryName = translateCategoryOrSubcategory('Baby Care', true);
  
  // Translate a single subcategory
  const subcategoryName = translateCategoryOrSubcategory('Juice', false);
  
  // Translate multiple items
  const translatedItems = translateMultiple(['Juice', 'Shampoo', 'Butter']);
  
  return (
    <div>
      <h1>{categoryName}</h1>
      <p>{subcategoryName}</p>
    </div>
  );
};
```

### Direct Utility Usage

```typescript
import { translateCategoryName } from '@/utils/categoryTranslation';
import { useTranslation } from '@/contexts/LanguageContext';

const { t } = useTranslation();
const translatedName = translateCategoryName('Baby Care', t, true);
```

## Adding New Translations

### Step 1: Add Translation Keys

Add new translation keys to `contexts/LanguageContext.tsx`:

```typescript
// For categories
'categories.new_category': 'New Category',

// For subcategories
'subcategories.new_subcategory': 'New Subcategory',
```

### Step 2: Add Predefined Mappings (Optional)

For frequently used items, add them to the predefined mappings in `utils/categoryTranslation.ts`:

```typescript
export const CATEGORY_MAPPINGS: Record<string, string> = {
  // existing mappings...
  'New Category': 'categories.new_category',
  'new-category': 'categories.new_category',
};

export const SUBCATEGORY_MAPPINGS: Record<string, string> = {
  // existing mappings...
  'New Subcategory': 'subcategories.new_subcategory',
  'new-subcategory': 'subcategories.new_subcategory',
};
```

### Step 3: Test the Translation

The system will automatically handle the new translations. Test by using the category/subcategory name in your components.

## Database Integration

When new categories or subcategories are added to the Supabase products table:

1. **Automatic Key Generation**: The system automatically generates translation keys
2. **Fallback Handling**: If no translation exists, the original text is displayed
3. **Case Insensitive**: The system handles various text formats (spaces, hyphens, case variations)

### Example Database Values

| Database Value | Generated Key | Display (if translated) |
|----------------|---------------|------------------------|
| "Baby Care" | `categories.baby_care` | "Baby Care" |
| "baby-care" | `categories.baby_care` | "Baby Care" |
| "Juice" | `subcategories.juice` | "Juice" |
| "Garam Masala" | `subcategories.garam_masala` | "Garam Masala" |

## Supported Formats

The translation system handles various text formats:

- **Spaces**: "Baby Care" → `baby_care`
- **Hyphens**: "baby-care" → `baby_care`
- **Special Characters**: "Rice & Grains" → `rice_and_grains`
- **Mixed Case**: "BaBy CaRe" → `baby_care`

## Best Practices

1. **Consistent Naming**: Use consistent naming in the database
2. **Predefined Mappings**: Add frequently used items to predefined mappings
3. **Translation Keys**: Follow the `categories.key` and `subcategories.key` pattern
4. **Testing**: Test translations with various text formats
5. **Fallbacks**: Always provide meaningful fallback text

## Troubleshooting

### Translation Not Working

1. Check if the translation key exists in `LanguageContext.tsx`
2. Verify the key format matches the generated pattern
3. Ensure the hook is properly imported and used

### Key Generation Issues

1. Check for special characters that might not be handled
2. Verify the text format matches expected patterns
3. Test with the `generateTranslationKey` function directly

### Performance Considerations

1. Use predefined mappings for frequently accessed items
2. Consider caching for large datasets
3. Batch translate multiple items when possible

## Future Enhancements

1. **Multi-language Support**: Extend to support multiple languages
2. **Database-driven Translations**: Store translations in the database
3. **Admin Interface**: Create an interface for managing translations
4. **Automatic Translation**: Integrate with translation services
5. **Analytics**: Track which translations are most used

## Migration Guide

If migrating from the old hardcoded system:

1. Replace direct `t()` calls with `useCategoryTranslation` hook
2. Move hardcoded mappings to the centralized utility
3. Update translation keys to follow the new pattern
4. Test all existing translations

## Examples

### Complete Component Example

```typescript
import React from 'react';
import { useCategoryTranslation } from '@/hooks/useCategoryTranslation';

interface CategoryListProps {
  categories: string[];
  subcategories: string[];
}

const CategoryList: React.FC<CategoryListProps> = ({ categories, subcategories }) => {
  const { translateMultiple } = useCategoryTranslation();
  
  const translatedCategories = translateMultiple(categories, true);
  const translatedSubcategories = translateMultiple(subcategories, false);
  
  return (
    <div>
      <h2>Categories</h2>
      <ul>
        {translatedCategories.map((category, index) => (
          <li key={index}>{category}</li>
        ))}
      </ul>
      
      <h2>Subcategories</h2>
      <ul>
        {translatedSubcategories.map((subcategory, index) => (
          <li key={index}>{subcategory}</li>
        ))}
      </ul>
    </div>
  );
};

export default CategoryList;
```

This system provides a robust, scalable solution for handling category and subcategory translations that can grow with your database content.