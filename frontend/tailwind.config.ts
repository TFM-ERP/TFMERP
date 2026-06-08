import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── TFM Brand — charcoal (monochrome) ─────────────────────────────
        brand: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#475569',
          500: '#0F172A',   // primary accent (charcoal)
          600: '#1E293B',   // hover state
          700: '#0F172A',   // dark text on light bg
          800: '#020617',
          900: '#020617',
        },
        // ── Sidebar charcoal ──────────────────────────────────────────────
        sidebar: {
          DEFAULT: '#2B2E31',
          hover:   '#363A3E',
          active:  '#3D4045',
          border:  '#3D4045',
          text:    '#C9CACB',
          muted:   '#737679',
        },
        // ── Page surfaces ─────────────────────────────────────────────────
        surface: {
          DEFAULT: '#F4F5F7',
          card:    '#FFFFFF',
          border:  '#DFE1E6',
        },
        // ── Kept for backward compat ──────────────────────────────────────
        rental: {
          50:  '#F0F9FF',
          500: '#0369A1',
        },
        production: {
          50:  '#FFF8E6',
          500: '#7B5E14',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card:       '0 1px 3px 0 rgba(0,0,0,.08)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,.12)',
        panel:      '0 1px 4px 0 rgba(0,0,0,.10)',
      },
    },
  },
  plugins: [],
};

export default config;
