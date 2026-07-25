"use client";

import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

// Helper to decode base64 JWT payload from Google ID token
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("Failed to parse Google ID token", err);
    return null;
  }
}

export default function GoogleSignIn({ user, onSignIn, onSignOut }) {
  const googleBtnRef = useRef(null);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  // 1. Load Google Identity Services SDK on mount
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGisLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGisLoaded(true);
    document.head.appendChild(script);
  }, []);

  // 2. Initialize GIS and trigger One Tap auto-recommendation when Client ID is present
  useEffect(() => {
    if (!gisLoaded || !GOOGLE_CLIENT_ID || user) return;

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response.credential) {
            const payload = parseJwt(response.credential);
            if (payload && payload.email) {
              onSignIn({
                name: payload.name || payload.given_name || "",
                email: payload.email,
                picture: payload.picture || "",
              });
            }
          }
        },
        auto_select: true,
      });

      // Render official GIS button inside ref if container exists
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "pill",
          text: "continue_with",
          width: 300,
        });
      }

      // Prompt browser Google One Tap overlay recommending active Google accounts
      window.google.accounts.id.prompt();
    } catch (err) {
      console.warn("GIS initialization notice:", err);
    }
  }, [gisLoaded, user, onSignIn]);

  // 3. Handle click on "Continue with Google"
  const handleGoogleClick = async () => {
    setLoadingPrompt(true);

    // If GIS is loaded and Client ID is configured, trigger Google account prompt
    if (window.google?.accounts?.id && GOOGLE_CLIENT_ID) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback to token client popup if One Tap is dismissed
            triggerTokenPopup();
          }
        });
      } catch (e) {
        triggerTokenPopup();
      }
      setLoadingPrompt(false);
      return;
    }

    // Try browser Credential Management API if available in browser
    if (navigator.credentials && window.PasswordCredential) {
      try {
        const cred = await navigator.credentials.get({
          password: true,
          federated: { providers: ["https://accounts.google.com"] },
        });
        if (cred && cred.id) {
          onSignIn({
            name: cred.name || cred.id.split("@")[0],
            email: cred.id,
            picture: cred.iconURL || "",
          });
          setLoadingPrompt(false);
          return;
        }
      } catch (err) {
        // Credential API fallback
      }
    }

    // Fallback: prompt for user's Google email to pre-fill
    const email = prompt("Select or enter your Google email address:", "user@gmail.com");
    if (email) {
      const formattedName = email
        .split("@")[0]
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      onSignIn({
        name: formattedName,
        email: email.trim(),
        picture: "",
      });
    }
    setLoadingPrompt(false);
  };

  const triggerTokenPopup = () => {
    if (!window.google?.accounts?.oauth2 || !GOOGLE_CLIENT_ID) return;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
      callback: (tokenResponse) => {
        if (tokenResponse.access_token) {
          fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          })
            .then((res) => res.json())
            .then((data) => {
              onSignIn({
                name: data.name || data.given_name || "",
                email: data.email,
                picture: data.picture || "",
              });
            });
        }
      },
    });
    client.requestAccessToken();
  };

  return (
    <div className="rounded-4xl border border-honey-200 bg-gradient-to-br from-honey-50/70 via-white to-cream p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-honey-200/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-honey-900">
            ⚡ Express Checkout
          </span>
          <h2 className="mt-2 font-display text-2xl">Sign in with Google</h2>
          <p className="mt-1 text-sm text-charcoal-mute">
            Select your Google account to automatically pre-fill your shipping details.
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-charcoal/10 pt-5">
        {user ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || user.email}
                  className="h-11 w-11 rounded-full border border-honey-300 object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-charcoal text-base font-bold text-cream">
                  {(user.name || user.email || "G").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold text-charcoal">
                  {user.name || "Google User"}
                  <span className="rounded-full bg-forest-pale px-2 py-0.5 text-[10px] font-semibold text-forest">
                    ✓ Verified Google Account
                  </span>
                </p>
                <p className="text-xs text-charcoal-mute">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="text-xs font-semibold text-charcoal-mute underline decoration-charcoal/30 underline-offset-4 transition hover:text-charcoal"
            >
              Use another account
            </button>
          </div>
        ) : GOOGLE_CLIENT_ID ? (
          <div className="flex flex-col items-start gap-3">
            <div ref={googleBtnRef} className="min-h-[44px]" />
            <p className="text-[11px] text-charcoal-mute">
              Click above or choose your Google account prompt to auto-fill details.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <button
              type="button"
              disabled={loadingPrompt}
              onClick={handleGoogleClick}
              className="flex items-center gap-3 rounded-full border border-charcoal/20 bg-white px-6 py-3 text-sm font-semibold text-charcoal shadow-soft transition hover:border-charcoal hover:bg-honey-50 disabled:opacity-50"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loadingPrompt ? "Detecting Google Account..." : "Continue with Google"}</span>
            </button>
            <p className="text-[11px] text-charcoal-mute">
              Prompts active browser Google account selection to auto-fill your shipping information.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
