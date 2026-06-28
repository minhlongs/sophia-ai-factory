import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        // Stitch-specific spacing
        'container-max': '1280px',
        gutter: '24px',
        'margin-mobile': '16px',
        'margin-desktop': '32px',
      },
      colors: {
        // Stitch MD3 color palette (maps to CSS variables)
        primary: {
          DEFAULT: 'var(--primary)',
          container: 'var(--primary-container)',
          foreground: 'var(--primary-foreground)',
          fixed: 'var(--primary-fixed)',
          fixedDim: 'var(--primary-fixed-dim)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          container: 'var(--secondary-container)',
          foreground: 'var(--on-secondary)',
        },
        tertiary: {
          DEFAULT: 'var(--tertiary)',
          container: 'var(--tertiary-container)',
        },
        surface: {
          DEFAULT: 'var(--background)',
          container: 'var(--card)',
          containerLowest: 'var(--card)',
          containerLow: 'var(--muted)',
          containerHigh: 'var(--muted)',
          containerHighest: 'var(--muted)',
          bright: 'var(--background-secondary)',
          dim: 'var(--muted)',
          variant: 'var(--muted)',
        },
        'on-surface': {
          DEFAULT: 'var(--foreground)',
          variant: 'var(--muted-foreground)',
        },
        outline: {
          DEFAULT: 'var(--border)',
          variant: 'var(--border)',
        },
        error: {
          DEFAULT: 'var(--destructive)',
          container: 'var(--destructive)',
        },
        // Chart colors for data visualization
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        'neon-cyan': 'var(--neon-cyan)',
        'neon-purple': 'var(--neon-purple)',
        'neon-pink': 'var(--neon-pink)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "gradient-space": "var(--gradient-space)",
        "gradient-neon": "var(--gradient-neon)",
      },
      fontFamily: {
        // Stitch uses Inter for all text
        'display-lg': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        'headline-xl': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        'headline-lg': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        'headline-md': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        'headline-sm': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        'body-lg': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        'body-md': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        'body-sm': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        'label-lg': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        'label-md': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        'label-sm': ['Inter', 'var(--font-plus-jakarta)', 'sans-serif'],
        code: ['var(--font-geist-mono)', 'JetBrains Mono', 'monospace'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        sans: ['Inter', 'var(--font-plus-jakarta)', 'Arial', 'Helvetica', 'sans-serif'],
      },
      fontSize: {
        // Stitch typography scale
        'display-lg': ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-xl': ['36px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-lg-mobile': ['24px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'label-lg': ['16px', { lineHeight: '1.5', fontWeight: '500' }],
        'label-md': ['14px', { lineHeight: '1', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '1', letterSpacing: '0.02em', fontWeight: '600' }],
        code: ['14px', { lineHeight: '1.5', fontWeight: '400', fontFamily: 'var(--font-geist-mono), monospace' }],
      },
    },
  },
  plugins: [],
};

export default config;
