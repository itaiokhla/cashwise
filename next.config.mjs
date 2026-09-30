// /** @type {import('next').NextConfig} */
// const nextConfig = {};

// export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
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
