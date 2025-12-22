/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#070A14',
          2: '#0B1220',
          3: '#0F1B2E',
          4: '#13223A',
        },
        text: {
          DEFAULT: '#EAF2FF',
          2: '#B8CCEA',
          3: '#8BA3C9',
        },
        stroke: {
          DEFAULT: 'rgba(255,255,255,0.12)',
          2: 'rgba(255,255,255,0.08)',
        },

        /* Student brand: Teal */
        accent: {
          DEFAULT: '#14B8A6', // teal-500
          2: '#0D9488',
          glow: 'rgba(20,184,166,0.35)',
        },

        success: '#22C55E',
        danger: '#EF4444',
        warn: '#F59E0B',
      },

      boxShadow: {
        soft: '0 12px 40px rgba(0,0,0,0.55)',
        card: '0 10px 30px rgba(0,0,0,0.45)',
        glow: '0 0 0 1px rgba(20,184,166,0.24), 0 18px 60px rgba(20,184,166,0.10)',
      },

      borderRadius: {
        xl2: '1.25rem',
      },

      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseGlow: {
          '0%,100%': {
            boxShadow:
              '0 0 0 1px rgba(20,184,166,0.18), 0 18px 60px rgba(20,184,166,0.08)',
          },
          '50%': {
            boxShadow:
              '0 0 0 1px rgba(20,184,166,0.32), 0 18px 60px rgba(20,184,166,0.14)',
          },
        },
      },

      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        pulseGlow: 'pulseGlow 3.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
