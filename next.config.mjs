/** @type {import('next').NextConfig} */
const nextConfig = {
  // 与 Dockerfile 一致，便于打包进 EXE/DMG 时复制 .next/standalone
  output: "standalone",
  // 关闭开发环境右下角 Next.js 指示器（N 按钮）
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/oneone-dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
