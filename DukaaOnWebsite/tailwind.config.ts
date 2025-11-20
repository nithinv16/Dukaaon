import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Colors
        primary: {
          orange: '#FF6B35',
          dark: '#1A1A1A',
          gray: '#545454',
        },
        // Secondary Colors
        secondary: {
          blue: '#004E89',
          green: '#2A9D8F',
        },
        // Neutral Colors
        neutral: {
          white: '#FFFFFF',
          light: '#F4F4F4',
          medium: '#CCCCCC',
          dark: '#333333',
        },
        // Accent Colors
        accent: {
          yellow: '#FFB703',
          red: '#E63946',
        },
      },
      fontFamily: {
        heading: ['Inter', 'Poppins', 'sans-serif'],
        body: ['Inter', 'Open Sans', 'sans-serif'],
      },
      fontSize: {
        xs: '0.75rem', // 12px
        sm: '0.875rem', // 14px
        base: '1rem', // 16px
        lg: '1.125rem', // 18px
        xl: '1.25rem', // 20px
        '2xl': '1.5rem', // 24px
        '3xl': '1.875rem', // 30px
        '4xl': '2.25rem', // 36px
        '5xl': '3rem', // 48px
        '6xl': '3.75rem', // 60px
      },
      spacing: {
        '1': '0.25rem', // 4px
        '2': '0.5rem', // 8px
        '3': '0.75rem', // 12px
        '4': '1rem', // 16px
        '6': '1.5rem', // 24px
        '8': '2rem', // 32px
        '12': '3rem', // 48px
        '16': '4rem', // 64px
        '24': '6rem', // 96px
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-in-out',
        'slide-in': 'slideIn 0.6s ease-in-out',
        'scale-in': 'scaleIn 0.4s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
