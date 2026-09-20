import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/land/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/forest/**/*.{js,ts,jsx,tsx,mdx}",
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
        // Obsidian Cyber-Glass: Be Vietnam Pro (display) + Plus Jakarta Sans (body) + JetBrains Mono (code)
        'display-lg': ['"Be Vietnam Pro"', 'var(--font-be-vietnam-pro)', 'sans-serif'],
        'headline-xl': ['"Be Vietnam Pro"', 'var(--font-be-vietnam-pro)', 'sans-serif'],
        'headline-lg': ['"Be Vietnam Pro"', 'var(--font-be-vietnam-pro)', 'sans-serif'],
        'headline-md': ['"Be Vietnam Pro"', 'var(--font-be-vietnam-pro)', 'sans-serif'],
        'headline-sm': ['"Be Vietnam Pro"', 'var(--font-be-vietnam-pro)', 'sans-serif'],
        'body-lg': ['"Plus Jakarta Sans"', 'var(--font-dm-sans)', 'sans-serif'],
        'body-md': ['"Plus Jakarta Sans"', 'var(--font-dm-sans)', 'sans-serif'],
        'body-sm': ['"Plus Jakarta Sans"', 'var(--font-dm-sans)', 'sans-serif'],
        'label-lg': ['"Plus Jakarta Sans"', 'var(--font-dm-sans)', 'sans-serif'],
        'label-md': ['"Plus Jakarta Sans"', 'var(--font-dm-sans)', 'sans-serif'],
        'label-sm': ['"Plus Jakarta Sans"', 'var(--font-dm-sans)', 'sans-serif'],
        code: ['"JetBrains Mono"', 'var(--font-jetbrains-mono)', 'monospace'],
        mono: ['"JetBrains Mono"', 'var(--font-jetbrains-mono)', 'monospace'],
        sans: ['"Plus Jakarta Sans"', 'var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Stitch typography scale (unchanged — font families changed above)
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
        code: ['14px', { lineHeight: '1.5', fontWeight: '400', fontFamily: 'var(--font-jetbrains-mono), monospace' }],
      },
    },
  },
  plugins: [],
};

export default config;
