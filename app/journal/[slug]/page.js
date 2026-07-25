import { notFound } from "next/navigation";
import Link from "next/link";
import { articles, getArticle } from "@/lib/articles";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }) {
  const article = getArticle(params.slug);
  if (!article) return {};
  return { title: article.title, description: article.excerpt };
}

export default function ArticlePage({ params }) {
  const article = getArticle(params.slug);
  if (!article) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    author: { "@type": "Organization", name: "Buzzora" },
  };

  const others = articles.filter((a) => a.slug !== params.slug).slice(0, 2);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6 md:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <nav className="text-xs text-charcoal-mute">
        <Link href="/journal" className="hover:text-honey-700">← The Honey Journal</Link>
      </nav>
      <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">{article.title}</h1>
      <div
        className="mt-8 flex h-40 items-center justify-center rounded-4xl text-6xl"
        style={{ backgroundColor: `${article.tone}22` }}
      >
        🍯
      </div>
      <div className="mt-8 space-y-5">
        {article.body.map((para, i) => (
          <p key={i} className="text-base leading-relaxed text-charcoal-soft">
            {para}
          </p>
        ))}
      </div>

      <div className="mt-12 rounded-4xl bg-parchment p-7 text-center">
        <p className="font-display text-2xl">Taste what you just read.</p>
        <Link href="/shop" className="btn-primary mt-4">
          Shop Raw Honey
        </Link>
      </div>

      {others.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl">Keep reading</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {others.map((a) => (
              <Link
                key={a.slug}
                href={`/journal/${a.slug}`}
                className="rounded-2xl border border-charcoal/10 bg-white p-5 transition hover:shadow-soft"
              >
                <p className="font-display text-lg">{a.title}</p>
                <p className="mt-1 text-sm text-charcoal-mute">{a.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
