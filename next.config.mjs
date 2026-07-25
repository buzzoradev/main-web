/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export mode is used by the GitHub Pages deploy workflow
  // (.github/workflows/deploy-pages.yml). The Vercel/server build ignores it.
  ...(process.env.NEXT_EXPORT === "1" ? { output: "export" } : {}),
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
};
export default nextConfig;
