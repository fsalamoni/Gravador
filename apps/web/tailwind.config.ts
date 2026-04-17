/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0b0e14',
        surface: '#141824',
        surfaceAlt: '#1b2030',
        border: '#262b3c',
        accent: '#7c5cff',
        accentSoft: '#a08bff',
        text: '#e6e8ef',
        mute: '#8a90a2',
        danger: '#ff5c7c',
        ok: '#34d399',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
