/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      spacing: {
        4.5: '1.125rem',
      },
      fontFamily: {
        sans: ['InterVariable', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        surface2: 'rgb(var(--color-surface-2) / <alpha-value>)',
        line: 'rgb(var(--color-border) / <alpha-value>)',
        ink: 'rgb(var(--color-text) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        brand: {
          50: '#F2EEFF',
          100: '#E5DEFF',
          200: '#C9BBFF',
          300: '#AC98FF',
          400: '#9077FF',
          500: '#7C5CFF',
          600: '#6D47F5',
          700: '#5936D6',
          800: '#4527A8',
          900: '#331D7A',
        },
        positive: {
          DEFAULT: '#10B981',
          soft: '#10B98122',
        },
        negative: {
          DEFAULT: '#F43F5E',
          soft: '#F43F5E22',
        },
        warning: {
          DEFAULT: '#F59E0B',
          soft: '#F59E0B22',
        },
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        soft: '0 2px 10px -2px rgb(0 0 0 / 0.15), 0 8px 24px -8px rgb(0 0 0 / 0.25)',
        glow: '0 0 0 1px rgb(124 92 255 / 0.4), 0 8px 30px -8px rgb(124 92 255 / 0.5)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up-sheet': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'progress-fill': {
          '0%': { width: '0%' },
          '100%': { width: 'var(--fill-to, 100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.45s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16,1,0.3,1) both',
        'slide-up-sheet': 'slide-up-sheet 0.28s cubic-bezier(0.16,1,0.3,1) both',
        shimmer: 'shimmer 2s linear infinite',
        'progress-fill': 'progress-fill 0.8s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fade-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
}
