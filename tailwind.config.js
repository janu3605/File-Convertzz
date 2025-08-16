/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  darkMode: ["class"],
  content: [
    './src/**/*.{js,jsx}', // Corrected content path
  ],
  theme: {
    extend: {
      fontFamily: {
        'pixel': ['VT323', 'monospace'],
      },
      colors: {
        'brand-bg': '#1a1a1a',
        'brand-primary': '#fb923c', // orange-400
        'brand-secondary': '#333',
        'brand-text': '#f5f5f5',   // neutral-100
      },
      // Keyframes for the UI animations
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', textShadow: '0 0 10px #fb923c' },
          '50%': { opacity: '0.7', textShadow: '0 0 20px #f97316' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}