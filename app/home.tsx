import { Redirect } from 'expo-router';

/**
 * Direct redirect to main home screen
 * 
 * This file exists as a fallback route for /home navigation.
 * It immediately redirects to the proper home screen without
 * showing any loading state to minimize navigation latency.
 * 
 * **Validates: Requirements 5.1** - Navigation redirect minimization
 * The redirect is instant (no useEffect delay) to reduce redirect chain latency.
 */
export default function DirectHome() {
  // Instant redirect - no loading state, no delay
  // This minimizes the redirect chain from index.tsx → home → (main)/home
  return <Redirect href="/(main)/home/" />;
}