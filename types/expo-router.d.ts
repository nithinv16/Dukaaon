declare module 'expo-router' {
  import { ComponentProps, ComponentType } from 'react';
  
  export function useRouter(): {
    push: (href: string, options?: any) => void;
    replace: (href: string, options?: any) => void;
    back: () => void;
    canGoBack: () => boolean;
  };
  
  export function useLocalSearchParams<T extends Record<string, string> = {}>(): T;
  
  export namespace Link {
    type Props = {
      href: string;
      asChild?: boolean;
      replace?: boolean;
    };
  }
  
  export const Link: ComponentType<ComponentProps<'a'> & Link.Props>;
  
  export namespace Stack {
    type Props = {
      screenOptions?: {
        headerShown?: boolean;
        gestureEnabled?: boolean;
        animation?: string;
      };
      children?: React.ReactNode;
    };
    
    type ScreenProps = {
      name: string;
      options?: {
        title?: string;
        headerTitle?: string;
        headerShown?: boolean;
        gestureEnabled?: boolean;
        redirect?: boolean;
        headerLeft?: () => React.ReactNode;
        headerRight?: () => React.ReactNode;
      };
    };
    
    export const Screen: ComponentType<ScreenProps>;
  }
  
  export const Stack: ComponentType<Stack.Props> & {
    Screen: typeof Stack.Screen;
  };
}