import Link from "next/link";
import AdminSignOutButton from "./AdminSignOutButton";

export default function AdminHeader({ adminContext, currentSection = "dashboard" }) {
  return (
    <header className="border-b border-stone-800 bg-stone-900/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Section Navigation */}
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2.5">
              <span className="text-2xl">🍯</span>
              <span className="font-serif text-lg tracking-wider text-amber-400 font-semibold">
                BUZZORA
              </span>
              <span className="hidden md:inline-block text-xs uppercase tracking-widest text-stone-400 border-l border-stone-800 pl-3">
                Console
              </span>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                id="admin-nav-dashboard"
                href="/admin"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  currentSection === "dashboard"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60"
                }`}
              >
                Dashboard
              </Link>
              <Link
                id="admin-nav-orders"
                href="/admin/orders"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  currentSection === "orders"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60"
                }`}
              >
                Orders
              </Link>
              <Link
                id="admin-nav-payments"
                href="/admin/payments"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  currentSection === "payments"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60"
                }`}
              >
                Payments
              </Link>
              <Link
                id="admin-nav-coupons"
                href="/admin/coupons"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  currentSection === "coupons"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60"
                }`}
              >
                Coupons
              </Link>
              <Link
                id="admin-nav-audit"
                href="/admin/audit"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  currentSection === "audit"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60"
                }`}
              >
                Audit Log
              </Link>
            </nav>
          </div>

          {/* Admin User Info & Sign Out */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                id="admin-role-badge"
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20"
              >
                {adminContext?.role || "admin"}
              </span>
              <span
                id="admin-user-email"
                className="hidden lg:inline-block text-xs text-stone-400 font-mono"
              >
                {adminContext?.email}
              </span>
            </div>
            <AdminSignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
