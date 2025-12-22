/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // ✅ Dark surfaces (keep your current vibe)
        surface: {
          DEFAULT: '#070A14',
          2: '#0B1220',
          3: '#0F1B2E',
          4: '#13223A',
        },

        // ✅ Text hierarchy
        text: {
          DEFAULT: '#EAF2FF',
          2: '#B8C7E6',
          3: '#7F97BE',
        },

        // ✅ Borders / separators
        stroke: {
          DEFAULT: 'rgba(255,255,255,0.12)',
          2: 'rgba(255,255,255,0.08)',
        },

        // ✅ New brand accent (Teal / Aqua)
        accent: {
          DEFAULT: '#2DD4BF', // teal-400
          2: '#14B8A6', // teal-500
          glow: 'rgba(45,212,191,0.35)',
        },

        // ✅ Semantic colors (states)
        success: '#22C55E',
        danger: '#EF4444',
        warn: '#F59E0B',
      },

      boxShadow: {
        soft: '0 12px 40px rgba(0,0,0,0.55)',
        card: '0 10px 30px rgba(0,0,0,0.45)',

        // ✅ Updated glow to match new teal accent
        glow: '0 0 0 1px rgba(45,212,191,0.25), 0 18px 60px rgba(45,212,191,0.10)',
      },

      borderRadius: {
        xl2: '1.25rem',
      },

      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },

        // ✅ Updated pulseGlow to match teal accent
        pulseGlow: {
          '0%,100%': {
            boxShadow:
              '0 0 0 1px rgba(45,212,191,0.20), 0 18px 60px rgba(45,212,191,0.08)',
          },
          '50%': {
            boxShadow:
              '0 0 0 1px rgba(45,212,191,0.35), 0 18px 60px rgba(45,212,191,0.14)',
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
