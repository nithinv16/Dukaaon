## Bottom Navigation Phone Button - Always Visible

The phone button ("Call To Order") is currently part of the `BottomNav` component, so when we hide the bottom nav, it hides too.

### Solution:

The phone button is positioned as `position: 'absolute'` with `zIndex: 10` and `top: -22`, making it float above the bottom nav. When the bottom nav is hidden (display removed from DOM), the phone button loses its anchor and disappears.

### Quick Fix:

Since the phone button has higher z-index (10) than the bottom nav container (1), and it's absolutely positioned relative to its parent, we just need to ensure the parent container stays in the DOM even when hidden.

Instead of completely removing the bottom nav from DOM, we should just move it off-screen or make it transparent while keeping the phone button visible.

### Implementation in _layout.tsx:

Keep the bottom nav rendered but conditionally style it:
```tsx
{user && !pathname.includes('/phone-order') && !pathname.includes('/wholesaler') && (
  <View style={[
    styles.bottomNav, 
    { paddingBottom: insets.bottom },
    !isVisible && styles.bottomNavHidden  // Add hidden style
  ]}>
    <BottomNav />
  </View>
)}
```

Add to styles:
```tsx
bottomNavHidden: {
  transform: [{ translateY: 100 }],  // Move off-screen
},
```

This way the phone button (which is absolutely positioned and floats above) stays visible while the nav tabs move down.
