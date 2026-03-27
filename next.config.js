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

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  publicExcludes: ['**/*.pdf'],
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Timeline manifest data (GitHub Pages default caching is aggressive; PWA must revalidate often)
      {
        urlPattern: /^https:\/\/clevertree\.github\.io\/paradigm-threat-timeline\/data\/events\.json(\?.*)?$/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pt-timeline-events',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 8, maxAgeSeconds: 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/clevertree\.github\.io\/paradigm-threat-timeline\/index\.json(\?.*)?$/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pt-timeline-index',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 8, maxAgeSeconds: 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/files\.paradigmthreat\.net\/index\.json(\?.*)?$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'pt-index',
          expiration: { maxEntries: 5, maxAgeSeconds: 3600 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/clevertree\.github\.io\/paradigm-threat-files\/index\.json(\?.*)?$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'pt-index-gh',
          expiration: { maxEntries: 5, maxAgeSeconds: 3600 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/files\.paradigmthreat\.net\/[^?]+\.(md|mdx)(\?.*)?$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'pt-articles',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/clevertree\.github\.io\/paradigm-threat-files\/[^?]+\.(md|mdx)(\?.*)?$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'pt-articles-gh',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
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

// Merge MDX config, then PWA
module.exports = withPWA(withMDX(nextConfig))
