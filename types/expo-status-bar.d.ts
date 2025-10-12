declare module 'expo-status-bar' {
  import React from 'react';
  
  export interface StatusBarProps {
    style?: 'auto' | 'inverted' | 'light' | 'dark';
    backgroundColor?: string;
    translucent?: boolean;
    hidden?: boolean;
  }
  
  export class StatusBar extends React.Component<StatusBarProps> {}
} 