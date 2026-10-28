/** @type {import('tailwindcss').Config} */
// Los colores apuntan a variables CSS (src/index.css). Cambiar marca = cambiar variables.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg)',
        surface: 'var(--surface)',
        sunken: 'var(--sunken)',
        line: 'var(--line)',
        'line-soft': 'var(--line-soft)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-2)',
        'ink-faint': 'var(--ink-3)',
        brand: {
          DEFAULT: 'var(--brand)',
          deep: 'var(--brand-deep)',
          mid: 'var(--brand-mid)',
          soft: 'var(--brand-soft)',
          wash: 'var(--brand-wash)',
        },
        ok: { DEFAULT: 'var(--ok)', soft: 'var(--ok-soft)', ink: 'var(--ok-ink)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)', ink: 'var(--warn-ink)' },
        crit: { DEFAULT: 'var(--crit)', soft: 'var(--crit-soft)', ink: 'var(--crit-ink)' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        kpi: ['36px', { lineHeight: '1', fontWeight: '800', letterSpacing: '-0.04em' }],
        h1: ['32px', { lineHeight: '38px', fontWeight: '800', letterSpacing: '-0.035em' }],
        h2: ['24px', { lineHeight: '30px', fontWeight: '800', letterSpacing: '-0.025em' }],
        h3: ['17px', { lineHeight: '24px', fontWeight: '700', letterSpacing: '-0.01em' }],
        body: ['16px', '24px'],
        dense: ['15px', '22px'],
        label: ['14px', { lineHeight: '18px', fontWeight: '700' }],
        overline: ['13px', { lineHeight: '18px', fontWeight: '700', letterSpacing: '0.06em' }],
      },
      borderRadius: { ctl: '10px', card: '14px' },
      boxShadow: { card: 'var(--sh1)', lift: 'var(--sh2)', float: 'var(--sh3)' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        drawer: { from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        flash: { '0%': { backgroundColor: 'var(--brand-soft)' }, '100%': { backgroundColor: 'var(--surface)' } },
      },
      animation: {
        rise: 'rise 240ms cubic-bezier(.2,.7,.3,1) both',
        fade: 'fade 200ms ease-out both',
        drawer: 'drawer 220ms cubic-bezier(.2,.7,.3,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        flash: 'flash 600ms ease-out',
      },
    },
  },
  plugins: [],
}
