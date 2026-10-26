/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta institucional (ajustable según el Manual de Identidad UHO)
        brand: {
          50: '#eef4fb',
          100: '#d7e5f6',
          200: '#b3cdec',
          300: '#83acdd',
          400: '#5287c9',
          500: '#2f67ae',
          600: '#235290',
          700: '#1b4074',
          800: '#14305c',
          900: '#0d2240',
          950: '#081628',
        },
        gold: {
          50: '#fdf8e9',
          100: '#f9edc4',
          200: '#f2d98c',
          300: '#eac355',
          400: '#e2b032',
          500: '#d9a441',
          600: '#b88323',
          700: '#93651d',
          800: '#7a521e',
          900: '#68451e',
        },
        surface: '#f6f8fb',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(13, 34, 64, 0.06), 0 8px 24px -12px rgba(13, 34, 64, 0.18)',
        float: '0 18px 40px -20px rgba(13, 34, 64, 0.45)',
      },
      borderRadius: {
        xl2: '1rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
