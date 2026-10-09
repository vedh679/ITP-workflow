/** @type {import('tailwindcss').Config} */
// Design language: see docs/design-language.md
//
// The app was originally built on a dark `slate` palette with blue/purple accents.
// Rather than rewriting every class, those scales are remapped here to the new light
// theme, so existing `bg-slate-900`, `text-slate-400`, `bg-blue-600` … resolve to:
//   slate  → inverted neutral scale (950 = white shell … 50 = ink)
//   blue / purple → ink (solid buttons) + coral (tints and links)
//   green / red / amber / emerald → status colours tuned for light backgrounds
const coralTints = {
  50: '#FEF3F0', 100: '#FBE3DD', 200: '#F6C9BF', 300: '#C9432A', 400: '#E2634B',
  500: '#2B2B2B', 600: '#0B0B0B', 700: '#2B2B2B', 800: '#E2634B', 900: '#E2634B', 950: '#E2634B',
}
const status = (text, base, t50, t100) => ({
  50: t50, 100: t100, 200: text, 300: text, 400: base,
  500: base, 600: base, 700: text, 800: base, 900: base, 950: base,
})

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#0B0B0B', soft: '#2B2B2B' },
        canvas: '#BDBDBD',
        coral: { DEFAULT: '#E2634B', dark: '#C9432A', tint: '#FBE3DD' },
        slate: {
          50: '#0B0B0B', 100: '#171717', 200: '#262626', 300: '#404040', 400: '#6B6B6B',
          500: '#8F8F8F', 600: '#B8B8B8', 700: '#E4E4E4', 800: '#F1F1F1', 900: '#F7F7F7', 950: '#FFFFFF',
        },
        blue: coralTints,
        sky: coralTints,
        indigo: coralTints,
        purple: {
          ...coralTints,
          300: '#404040', 400: '#6B6B6B', 800: '#0B0B0B', 900: '#0B0B0B', 950: '#0B0B0B',
        },
        green: { ...status('#15803D', '#16A34A', '#F0FDF4', '#DCFCE7'), 500: '#22C55E', 600: '#16A34A', 700: '#15803D' },
        emerald: { ...status('#15803D', '#16A34A', '#F0FDF4', '#DCFCE7'), 500: '#22C55E', 600: '#16A34A', 700: '#15803D' },
        red: { ...status('#C93A3A', '#E5484D', '#FEF2F2', '#FEE2E2'), 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
        amber: { ...status('#B45309', '#D97706', '#FFFBEB', '#FEF3C7'), 500: '#F59E0B', 600: '#D97706' },
      },
      borderRadius: { shell: '40px' },
      boxShadow: {
        shell: '0 24px 60px -20px rgba(0,0,0,0.25)',
        float: '0 8px 24px -8px rgba(0,0,0,0.18)',
      },
    },
  },
  plugins: [],
}
