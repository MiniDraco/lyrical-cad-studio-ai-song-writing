/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      colors: {
        studio: {
          bg: '#0d0f14',
          surface: '#141720',
          panel: '#1a1e2a',
          border: '#252a38',
          hover: '#1e2435',
          accent: '#4a9eff',
          text: '#e2e8f0',
          muted: '#64748b',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
