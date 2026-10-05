/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          dark: '#0a0e1a',
          darker: '#060911',
          light: '#f8fafc',
          lighter: '#ffffff',
        },
        surface: {
          dark: 'rgba(18, 26, 48, 0.65)',
          darkBorder: 'rgba(255, 255, 255, 0.08)',
          light: 'rgba(255, 255, 255, 0.75)',
          lightBorder: 'rgba(0, 0, 0, 0.08)',
        },
        phase: {
          requirements: '#3b82f6',   // Blue
          decomposition: '#06b6d4',  // Cyan
          design: '#6366f1',         // Indigo
          codegen: '#8b5cf6',        // Violet / Purple
          execution: '#f59e0b',      // Amber
          arbitration: '#f43f5e',    // Rose
          documentation: '#10b981',  // Emerald
          integrationFrom: '#06b6d4',
          integrationTo: '#9333ea',
        },
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.25)',
        'glass-lg': '0 12px 48px 0 rgba(0, 0, 0, 0.45)',
        'glow-indigo': '0 0 25px -5px rgba(99, 102, 241, 0.35)',
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.35)',
        'glow-rose': '0 0 25px -5px rgba(244, 63, 94, 0.35)',
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.35)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        'inner-glow-strong': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
