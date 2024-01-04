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
  // output: 'export',
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: ['i.ibb.co']
    // unoptimized: true,
  },
  // Configure pageExtensions to include md and mdx
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx', 'auto.mdx'],

  // Optionally, add any other Next.js config below
  reactStrictMode: true,
  sassOptions: {
    includePaths: [path.join(__dirname, 'app')]
  },
  // output: {path: path.resolve(__dirname, 'static'),},
  webpack: (config, options) => {
    //   // config.output.filename = '[path][name].[hash].[ext]';
    //   // config.output.path = path.resolve(__dirname, '.next/')
    //   // config.output.publicPath = '/.next/'
    const nextImageLoader = config.module.rules.find(rule => rule.loader === 'next-image-loader')
    // config.module.rules.push({
    //   ...nextImageLoader,
    //   test: /\.(webm|pdf|txt|csv)/,
    // })
    nextImageLoader.loader = path.join(process.cwd(), 'server/imageLoader.js')
    // config.module.rules.push({
    //   test: /\.(webm|pdf|txt|csv)/,
    //   type: 'asset/resource',
    //   // generator: {
    //   //   filename: 'out/_next/static/[path][name].[hash].[ext]'
    //   //   //   filename: `[name][ext]`
    //   // }
    // })
    config.module.rules.push({
      test: /\.(webm|pdf|txt|csv)/,
      use: [{
        loader: path.join(process.cwd(), 'server/fileLoader.js')
      }]
      // type: 'asset/resource',
      // generator: {
      //     filename: '.next/static/[path][name].[hash].[ext]'
      // },
    })
    //
    return config
  }
  // async headers () {
  //   return [
  //     {
  //       // matching all API routes
  //       source: '/api/:path*',
  //       headers: [
  //         { key: 'Access-Control-Allow-Credentials', value: 'true' },
  //         { key: 'Access-Control-Allow-Origin', value: '*' }, // replace this your actual origin
  //         { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
  //         {
  //           key: 'Access-Control-Allow-Headers',
  //           value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  //         }
  //       ]
  //     }
  //   ]
  // }
}

// Merge MDX config with Next.js config
module.exports = withMDX(nextConfig)
