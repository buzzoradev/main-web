import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-charcoal text-cream">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="font-display text-3xl">
              BUZZORA<span className="text-honey-400">.</span>
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider2 text-honey-300">
              From hive to heart
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-cream/70">
              Raw honey, ethically sourced from the valleys of Jammu &amp; Kashmir. From hive
              to jar — nothing added, nothing taken away.
            </p>
            <a
              href="https://www.instagram.com/_buzzora_/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-honey-300 transition hover:text-honey-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
              </svg>
              @_buzzora_
            </a>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider2 text-cream/50">Shop</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link href="/shop" className="text-cream/80 transition hover:text-honey-300">All Honey</Link></li>
              <li><Link href="/products/wild-tulsi-honey" className="text-cream/80 transition hover:text-honey-300">Wild Tulsi Honey</Link></li>
              <li><Link href="/products/multiflora-honey" className="text-cream/80 transition hover:text-honey-300">Multiflora Honey</Link></li>
              <li><Link href="/wholesale" className="text-cream/80 transition hover:text-honey-300">Wholesale</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider2 text-cream/50">Brand</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link href="/about" className="text-cream/80 transition hover:text-honey-300">Our Story</Link></li>
              <li><Link href="/hive-to-jar" className="text-cream/80 transition hover:text-honey-300">From Hive to Jar</Link></li>
              <li><Link href="/journal" className="text-cream/80 transition hover:text-honey-300">The Honey Journal</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-cream/10 pt-6 text-xs text-cream/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Buzzora. All rights reserved.</p>
          <p>From the valleys of Jammu &amp; Kashmir 🍯</p>
        </div>
      </div>
    </footer>
  );
}
