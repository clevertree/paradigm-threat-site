// next.config.js

const path = require('path')
const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/,
  options: {
    // If you use remark-gfm, you'll need to use next.config.mjs
    // as the package is ESM only
    // https://github.com/remarkjs/remark-gfm#install
    remarkPlugins: [],
    rehypePlugins: []
    // If you use `MDXProvider`, uncomment the following line.
    // providerImportSource: "@mdx-js/react",
  }
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the local animation package (ESM, needs Next.js compilation)
  transpilePackages: ['paradigm-threat-animation'],
  // output: 'export',
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'files.paradigmthreat.net',
      },
      {
        protocol: 'https',
        hostname: 'clevertree.github.io',
      }
    ],
    localPatterns: [
      {
        pathname: '/**',
        search: '?*',
      },
    ],
    unoptimized: true
  },
  // Configure pageExtensions to include md and mdx
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx', 'auto.mdx'],

  // Optionally, add any other Next.js config below
  reactStrictMode: true,
  sassOptions: {
    includePaths: [path.join(__dirname, 'app')]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'screen-wake-lock=*',
          },
        ],
      },
    ]
  },
  webpack(config) {
    // Allow importing .geojson files as JSON (for animation empire-boundaries)
    config.module.rules.push({
      test: /\.geojson$/,
      type: 'json',
    })
    return config
  },
}

// Merge MDX config with Next.js config
module.exports = withMDX(nextConfig)
