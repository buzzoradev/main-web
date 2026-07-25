import { products } from "@/lib/products";
import { articles } from "@/lib/articles";

const base = process.env.NEXT_PUBLIC_SITE_URL || "https://buzzora.co.in";

export default function sitemap() {
  const staticPages = ["", "/shop", "/about", "/hive-to-jar", "/journal", "/wholesale"].map(
    (path) => ({ url: `${base}${path}`, lastModified: new Date() })
  );
  const productPages = products.map((p) => ({
    url: `${base}/products/${p.slug}`,
    lastModified: new Date(),
  }));
  const articlePages = articles.map((a) => ({
    url: `${base}/journal/${a.slug}`,
    lastModified: new Date(),
  }));
  return [...staticPages, ...productPages, ...articlePages];
}
