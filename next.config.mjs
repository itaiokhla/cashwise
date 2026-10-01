// /** @type {import('next').NextConfig} */
// const nextConfig = {};

// export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep PDFKit outside the Next.js server bundle so its built-in AFM font
  // files resolve from node_modules/pdfkit/js/data at runtime.
  serverExternalPackages: ["pdfkit"],
  // Next 15's build-time lint runner passes options removed by the installed
  // ESLint API. Type checking still runs during builds; lint runs separately.
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Add domains for external image sources
    domains: ["ik.imagekit.io"],
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      // Ignore the canvas module in client-side builds
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },
};

export default nextConfig;
