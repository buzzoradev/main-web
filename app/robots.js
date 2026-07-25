const base = process.env.NEXT_PUBLIC_SITE_URL || "https://buzzora.co.in";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/checkout", "/order-success", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
