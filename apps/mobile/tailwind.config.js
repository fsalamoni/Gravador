/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Claro (light) palette — matches the default web theme
        bg: '#f8fafc',
        surface: '#ffffff',
        surfaceAlt: '#f1f5f9',
        border: '#cbd5e1',
        accent: '#3b82f6',
        accentSoft: '#60a5fa',
        text: '#0f172a',
        mute: '#64748b',
        danger: '#ef4444',
        ok: '#16a34a',
        onAccent: '#ffffff',
      },
    },
  },
  plugins: [],
};
