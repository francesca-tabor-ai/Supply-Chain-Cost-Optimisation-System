/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#09090b',
          900: '#111113',
          800: '#1a1a1f',
          700: '#27272e',
        },
        cool: {
          50: '#f8f8fa',
          100: '#f1f1f5',
          200: '#e4e4ef',
          300: '#c8c8d8',
          400: '#9898b0',
          500: '#6b6b88',
          600: '#4f4f6a',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 35%, #f43f5e 65%, #f59e0b 100%)',
        'gradient-cta': 'linear-gradient(135deg, #7c3aed 0%, #c026d3 50%, #e11d48 100%)',
        'gradient-metric': 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
        'gradient-hero': 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.08) 0%, transparent 65%)',
        'gradient-card-top': 'linear-gradient(180deg, rgba(139,92,246,0.04) 0%, transparent 100%)',
      },
      boxShadow: {
        'card': '0 1px 0 0 rgba(0,0,0,0.04), 0 4px 16px 0 rgba(0,0,0,0.05)',
        'card-hover': '0 1px 0 0 rgba(0,0,0,0.04), 0 8px 32px 0 rgba(0,0,0,0.09)',
        'glow': '0 0 0 1px rgba(139,92,246,0.2), 0 8px 32px rgba(139,92,246,0.15)',
        'glow-sm': '0 0 0 1px rgba(139,92,246,0.15), 0 2px 8px rgba(139,92,246,0.10)',
        'xl': '0 20px 60px 0 rgba(0,0,0,0.10), 0 4px 16px 0 rgba(0,0,0,0.06)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease forwards',
        'gradient-x': 'gradient-x 6s ease infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'gradient-x': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
}
