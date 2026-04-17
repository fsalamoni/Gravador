/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0b0e14',
        surface: '#141824',
        accent: '#7c5cff',
        accentSoft: '#a08bff',
        text: '#e6e8ef',
        mute: '#8a90a2',
        danger: '#ff5c7c',
        ok: '#34d399',
      },
    },
  },
  plugins: [],
};
