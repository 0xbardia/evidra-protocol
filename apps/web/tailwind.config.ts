import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#20201d',
        paper: '#f6f2e9',
        vermilion: '#e55536',
        amber: '#f0a43c',
        acid: '#c8d94f',
        moss: '#50624a',
        fog: '#e4dfd2',
      },
      boxShadow: {
        quiet: '0 18px 50px rgba(32, 32, 29, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
