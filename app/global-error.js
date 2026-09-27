"use client";

import { useEffect, useState } from "react";
import { generateErrorReferenceId } from "@/lib/error-id";

export default function GlobalError({ error, reset }) {
  const [refId] = useState(() => generateErrorReferenceId());

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[Buzzora Global Error Boundary]:", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong — Buzzora</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#fbf7ef",
          color: "#241c12",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: "32rem",
            margin: "0 auto",
            padding: "2.5rem 1.5rem",
            textAlign: "center",
          }}
        >
          {/* Brand Mark Icon */}
          <div style={{ marginBottom: "1.5rem" }}>
            <span style={{ fontSize: "3.5rem" }} role="img" aria-label="Bee">
              🐝
            </span>
          </div>

          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#a96f1e",
              margin: "0 0 0.5rem 0",
            }}
          >
            Buzzora Notice
          </p>

          <h1
            style={{
              fontSize: "2.25rem",
              lineHeight: 1.15,
              fontWeight: 600,
              margin: "0 0 1rem 0",
              color: "#241c12",
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              fontSize: "1rem",
              lineHeight: 1.6,
              color: "#6b5f4c",
              margin: "0 0 1.5rem 0",
            }}
          >
            We couldn&apos;t complete this request. Please try again or return to the Buzzora homepage.
          </p>

          {/* Reference ID Badge */}
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#ffffff",
              border: "1px solid rgba(36, 28, 18, 0.12)",
              borderRadius: "9999px",
              padding: "0.5rem 1.25rem",
              fontSize: "0.75rem",
              color: "#6b5f4c",
              marginBottom: "2rem",
            }}
          >
            <span style={{ fontWeight: 700, textTransform: "uppercase", color: "#8a5a1e", marginRight: "0.5rem" }}>
              Reference ID:
            </span>
            <code style={{ fontFamily: "monospace", fontWeight: 600, color: "#241c12" }}>
              {refId}
            </code>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                backgroundColor: "#e8a82b",
                color: "#241c12",
                border: "none",
                borderRadius: "9999px",
                padding: "0.85rem 1.75rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{
                backgroundColor: "#241c12",
                color: "#fbf7ef",
                textDecoration: "none",
                borderRadius: "9999px",
                padding: "0.85rem 1.75rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                display: "inline-block",
              }}
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
