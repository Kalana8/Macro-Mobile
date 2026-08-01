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
    // Without this, the client Router Cache can serve a page's previously
    // fetched RSC payload on in-app <Link> navigation even though the page
    // is force-dynamic — force-dynamic only controls server-side caching,
    // not this separate client-side layer. That let a stale Comm Log (from
    // before an access-control fix) keep showing threads that had already
    // been revoked, until a full app close/reopen. Setting this to 0 makes
    // every in-app navigation always re-fetch live, correctly-scoped data.
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
