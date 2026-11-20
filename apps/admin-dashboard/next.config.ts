import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@macro/shared"],
  // The monorepo root (apps/ + packages/). Without this, a stray lockfile in a
  // folder above made Next.js watch and compile that whole folder (the mobile
  // app included), and the dev server hung at full CPU.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
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
    // Turbopack's on-disk dev cache kept the dev server at full CPU
    // (constantly rewriting its cache) and slowed every page; compile in memory.
    turbopackFileSystemCacheForDev: false,
    // Without this, the client Router Cache can serve a page's previously
    // fetched RSC payload on in-app <Link> navigation even though the page
    // is force-dynamic — force-dynamic only controls server-side caching,
    // not this separate client-side layer. Setting this to 0 makes every
    // in-app navigation always re-fetch live, correctly-scoped data —
    // important for per-user private pages like Communication/Attendance.
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
