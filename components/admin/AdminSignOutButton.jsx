"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminSignOutButton({ className = "" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  };

  return (
    <button
      id="admin-signout-btn"
      onClick={handleSignOut}
      disabled={loading}
      className={
        className ||
        "px-4 py-2 text-xs font-medium tracking-wide uppercase rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition-colors disabled:opacity-50 cursor-pointer"
      }
    >
      {loading ? "Signing out..." : "Sign Out"}
    </button>
  );
}
