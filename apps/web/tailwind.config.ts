import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // La Grieta brand palette
        rift: {
          50: '#f0f4ff',
          100: '#dde7ff',
          200: '#c2d2ff',
          300: '#9db5ff',
          400: '#748fff',
          500: '#4f6af5',
          600: '#3a4eea',
          700: '#2f3dcf',
          800: '#2933a8',
          900: '#272f85',
          950: '#181c50',
        },
        surface: {
          DEFAULT: '#0f0f14',
          card: '#16161e',
          elevated: '#1e1e2a',
          border: '#2a2a3a',
        },
        rarity: {
          common: '#a1a1aa',
          uncommon: '#4ade80',
          rare: '#60a5fa',
          epic: '#c084fc',
          showcase: '#fbbf24',
        },
        status: {
          success: '#86efac',
          error: '#fca5a5',
          warning: '#fde68a',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out both',
        'card-enter': 'card-enter 0.3s ease-out both',
        'shimmer': 'shimmer 1.5s infinite',
        'rift-pulse': 'rift-pulse 3s ease-in-out infinite',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'card-enter': {
          from: { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'rift-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
