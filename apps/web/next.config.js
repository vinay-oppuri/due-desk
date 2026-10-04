import { env } from "@repo/env";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/auth", "@repo/env"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${env.API_BASE_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
