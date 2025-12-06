import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './context/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#0f766e',
          dark: '#115e59'
        },
        medical: '#1554c3',
        medicalDark: '#0f3f93',
        skyglass: '#dbeafe',
        deepSky: '#0e7490',
        risk: {
          green: '#16a34a',
          yellow: '#ca8a04',
          red: '#dc2626'
        }
      },
      boxShadow: {
        card: '0 4px 24px rgba(7, 89, 133, 0.08)'
      }
    }
  },
  plugins: []
};

export default config;
