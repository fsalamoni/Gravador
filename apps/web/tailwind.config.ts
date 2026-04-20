/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        surfaceAlt: 'rgb(var(--color-surfaceAlt) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        accentSoft: 'rgb(var(--color-accentSoft) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        mute: 'rgb(var(--color-mute) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        ok: 'rgb(var(--color-ok) / <alpha-value>)',
        onAccent: 'rgb(var(--color-onAccent) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia'],
      },
      boxShadow: {
        studio: '0 32px 120px -56px rgba(0, 0, 0, 0.9)',
      },
    },
  },
  plugins: [],
};
