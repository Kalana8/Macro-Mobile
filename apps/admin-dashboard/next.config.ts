import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@macro/shared"],
  // @imagekit/nodejs doesn't bundle cleanly for Server Actions (uses Node
  // internals the bundler can't statically analyze) — run it via Node's
  // native module resolution instead of bundling it.
  serverExternalPackages: ["@imagekit/nodejs"],
  // Default Server Action body limit is 1MB — too small for real camera
  // photos (JPG/PNG straight off a phone easily run several MB; only
  // heavily-compressed WebP fit under the default).
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
