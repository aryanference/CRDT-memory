import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        base: '14px',
      },
      fontWeight: {
        display: '700',
        body: '400',
        button: '600',
      },
      letterSpacing: {
        display: '-0.025em',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        pill: '9999px',
      },
      colors: {
        canvas: '#0a0a0a',
        surface: {
          soft: '#121212',
          card: '#1a1a1a',
          elevated: '#242424',
        },
        primary: {
          DEFAULT: '#faff69',
          active: '#e6eb52',
          disabled: '#3a3a1f',
        },
        ink: {
          DEFAULT: '#ffffff',
        },
        body: {
          DEFAULT: '#cccccc',
          strong: '#e6e6e6',
        },
        muted: {
          DEFAULT: '#888888',
          soft: '#5a5a5a',
        },
        hairline: {
          DEFAULT: '#2a2a2a',
          strong: '#3a3a3a',
        },
        'on-primary': '#0a0a0a',

        // Accent palette
        accent: {
          emerald: '#22c55e',
          rose: '#ef4444',
          blue: '#3b82f6',
        },

        // Node type colors (surface tints)
        node: {
          episodic: '#faff69',
          semantic: '#22c55e',
          procedural: '#3b82f6',
        },

        // Edge type colors
        edge: {
          causes: '#ef4444',
          enables: '#22c55e',
          prevents: '#ef4444',
          temporal: '#888888',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        elevated: '0 4px 12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
        overlay: '0 8px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
        glow: '0 0 0 2px #faff69, 0 0 12px rgba(250,255,105,0.25)',
        'glow-sm': '0 0 0 1px #faff69, 0 0 6px rgba(250,255,105,0.15)',
        'glow-emerald': '0 0 0 2px #22c55e, 0 0 12px rgba(34,197,94,0.2)',
        'glow-rose': '0 0 0 2px #ef4444, 0 0 12px rgba(239,68,68,0.2)',
        'glow-blue': '0 0 0 2px #3b82f6, 0 0 12px rgba(59,130,246,0.2)',
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
        'fade-in': 'fade-in 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'blink-dot': 'blink-dot 1.2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.4' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'blink-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
}

export default config
