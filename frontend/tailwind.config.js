/** Define the inherited slate/indigo palette and editorial reading rhythm. */
import colors from 'tailwindcss/colors';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: colors.white,
        surface: colors.white,
        'surface-raised': colors.slate[50],
        foreground: colors.slate[900],
        'foreground-muted': colors.slate[600],
        border: colors.slate[200],
        ring: colors.indigo[600],
        primary: colors.indigo,
        secondary: colors.slate,
        neutral: colors.slate,
        success: { foreground: '#346538', background: '#edf3ec' },
        warning: { foreground: colors.slate[800], background: colors.slate[50] },
        error: { foreground: '#9f2f2d', background: '#fdebec' },
        info: { foreground: colors.indigo[800], background: colors.indigo[50] },
      },
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Arial', 'sans-serif'],
        editorial: ['Georgia', '"Times New Roman"', 'serif'],
        mono: ['"SFMono-Regular"', 'Consolas', 'monospace'],
      },
      fontSize: {
        reading: ['1.125rem', { lineHeight: '1.65', fontWeight: '400' }],
        headline: ['clamp(2.5rem, 6vw, 4rem)', {
          lineHeight: '1.1',
          letterSpacing: '-0.03em',
          fontWeight: '400',
        }],
      },
      maxWidth: { reading: '65ch', shell: '68rem' },
      spacing: { section: '4rem' },
      borderRadius: { control: '0.375rem' },
      boxShadow: { overlay: '0 8px 24px rgb(15 23 42 / 0.08)' },
      transitionDuration: { quick: '150ms' },
      transitionTimingFunction: { calm: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      keyframes: {
        'preview-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'hero-enter': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      // Decorative preview motion is explicitly requested; opt in only when motion is safe.
      animation: { 'hero-enter': 'hero-enter 180ms ease-out both', 'preview-float': 'preview-float 6s ease-in-out infinite' },
    },
  },
  plugins: [],
};
