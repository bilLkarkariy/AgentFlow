import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12151b',
        inkmute: '#5b6472',
        rail: '#171b23',
        railtext: '#9aa4b2',
        canvas: '#f4f5f7',
        line: '#e3e6eb',
        agent: '#2b4c8c',
        tool: '#9a5b1f',
        live: '#1f8a4c',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        label: '0.09em',
      },
    },
  },
  plugins: [],
} satisfies Config;
