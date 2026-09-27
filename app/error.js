"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BeeCharacter from "@/components/BeeCharacter";
import { generateErrorReferenceId } from "@/lib/error-id";

export default function ErrorBoundary({ error, reset }) {
  const [refId] = useState(() => generateErrorReferenceId());

  useEffect(() => {
    // Development diagnostic logging without exposing details to user interface
    if (process.env.NODE_ENV !== "production") {
      console.error("[Buzzora Error Boundary]:", error);
    }
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 pb-20 pt-28 text-center sm:px-6 md:pt-36">
      <div className="relative mb-6">
        <BeeCharacter size={110} flap={true} expression="surprised" />
      </div>

      <p className="eyebrow text-honey-700">Notice</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl text-charcoal">
        Something went wrong
      </h1>

      <p className="mt-4 max-w-md text-base leading-relaxed text-charcoal-mute">
        We couldn&apos;t complete this request. Please try again or return to the Buzzora homepage.
      </p>

      {/* Safe Customer Error Reference ID */}
      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-charcoal/10 bg-white px-5 py-2 text-xs text-charcoal-mute shadow-xs">
        <span className="font-semibold uppercase tracking-wider text-honey-800">
          Reference ID:
        </span>
        <code className="font-mono font-medium text-charcoal">{refId}</code>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="btn-primary"
        >
          Try Again
        </button>
        <Link href="/" className="btn-dark">
          Go Home
        </Link>
        <Link href="/shop" className="btn-ghost">
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}
