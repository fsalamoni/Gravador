/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#120d0a',
        surface: '#1d1511',
        surfaceAlt: '#2a1f19',
        border: '#463429',
        accent: '#f38a37',
        accentSoft: '#ffc48f',
        text: '#f7efe7',
        mute: '#baa390',
        danger: '#ff705d',
        ok: '#79d4a7',
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
