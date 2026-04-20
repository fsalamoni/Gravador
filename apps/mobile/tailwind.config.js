/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
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
    },
  },
  plugins: [],
};
