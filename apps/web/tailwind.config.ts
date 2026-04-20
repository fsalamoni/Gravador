/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        surfaceAlt: 'var(--color-surfaceAlt)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        accentSoft: 'var(--color-accentSoft)',
        text: 'var(--color-text)',
        mute: 'var(--color-mute)',
        danger: 'var(--color-danger)',
        ok: 'var(--color-ok)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
