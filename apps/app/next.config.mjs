// @ts-check
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Binds Cloudflare env (D1, KV, R2, Turnstile) during `next dev` so
// getCloudflareContext() works the same locally as in production.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Default image loader is incompatible with Workers — the app uses plain <img>.
  images: { unoptimized: true },
  experimental: {
    // React 19 types interop + any future App Router tweaks live here.
  },
  transpilePackages: ['@gordonbeeming/design-system'],
};

export default nextConfig;
