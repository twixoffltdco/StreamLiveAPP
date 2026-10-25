import type { Config } from 'tailwindcss';

/**
 * Конфигурация Tailwind CSS в стиле "Zoomer 2026":
 * pure black фон, неоновые акценты TikTok-палитры, glassmorphism.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Неоновая палитра стриминговых платформ
        neon: {
          cyan: '#00f2ea',
          pink: '#fe2c55',
        },
        ink: '#000000',
      },
      backdropBlur: {
        glass: '20px',
      },
      boxShadow: {
        'neon-cyan': '0 0 18px rgba(0, 242, 234, 0.45)',
        'neon-pink': '0 0 18px rgba(254, 44, 85, 0.45)',
      },
      animation: {
        'spin-slow': 'spin 1.2s linear infinite',
        'pulse-neon': 'pulseNeon 1.6s ease-in-out infinite',
        'rise': 'rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 6px #00f2ea)' },
          '50%': { opacity: '0.55', filter: 'drop-shadow(0 0 14px #fe2c55)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
