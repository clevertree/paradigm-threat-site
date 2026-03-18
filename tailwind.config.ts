import type { Config } from 'tailwindcss'

/**
 * paradigm-threat-files has its own node_modules — never use ** from repo root
 * (Tailwind would scan thousands of dependency files). Scope to content dirs only.
 */
const paradigmThreatFilesContent = [
  '../paradigm-threat-files/blog/**/*.{md,mdx}',
  '../paradigm-threat-files/docs/**/*.{md,mdx}',
  '../paradigm-threat-files/governance/**/*.{md,mdx}',
  '../paradigm-threat-files/history/**/*.{md,mdx}',
  '../paradigm-threat-files/cosmos/**/*.{md,mdx}',
  '../paradigm-threat-files/events/**/*.{md,mdx}',
  '../paradigm-threat-files/influence/**/*.{md,mdx}',
  '../paradigm-threat-files/science/**/*.{md,mdx}',
  '../paradigm-threat-files/*.{md,mdx}', // root e.g. page.md
] as const

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './SAFELIST.txt',
    ...paradigmThreatFilesContent,
  ],
  theme: {
    extend: {
      screens: {
        // px only: mixing rem with Tailwind’s default px screens breaks min-/max-* variants
        toc: '1400px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
}
export default config
