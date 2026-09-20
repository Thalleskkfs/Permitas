import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // A área administrativa passou de /dashboard para /admin. O destino é protegido
    // pelo mesmo guarda, então o redirect não expõe nada.
    return [
      { source: "/dashboard", destination: "/admin", permanent: true },
      { source: "/dashboard/:path*", destination: "/admin/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
