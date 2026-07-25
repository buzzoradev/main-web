import "./globals.css";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { CartProvider } from "@/components/CartContext";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SplashScreen from "@/components/SplashScreen";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://buzzora.co.in";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Buzzora — Raw Honey from the Valleys of Jammu & Kashmir",
    template: "%s — Buzzora",
  },
  description:
    "From hive to jar, nothing added, nothing taken away. Raw honey — Wild Tulsi and Multiflora — ethically sourced from the serene valleys of Jammu & Kashmir.",
  keywords: [
    "raw honey",
    "Jammu Kashmir honey",
    "wild tulsi honey",
    "multiflora honey",
    "natural honey India",
  ],
  openGraph: {
    title: "Buzzora — Raw Honey from the Valleys of Jammu & Kashmir",
    description:
      "From hive to jar, nothing added, nothing taken away. Raw honey ethically sourced from J&K.",
    type: "website",
    siteName: "Buzzora",
  },
};

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Buzzora",
  url: SITE_URL,
  founder: { "@type": "Person", name: "Kannu Priya" },
  sameAs: ["https://www.instagram.com/_buzzora_/"],
  description:
    "Raw honey ethically sourced from the valleys of Jammu & Kashmir. From hive to jar, nothing added, nothing taken away.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="bg-cream font-sans text-charcoal antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <CartProvider>
          <SplashScreen />
          <Nav />
          {children}
          <Footer />
          <CartDrawer />
          <WhatsAppButton />
        </CartProvider>
      </body>
    </html>
  );
}
