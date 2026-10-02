import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/auth";
import { getAdminCoupons } from "@/lib/admin/coupons";
import AdminHeader from "@/components/admin/AdminHeader";
import CouponsManager from "@/components/admin/CouponsManager";
import AdminSignOutButton from "@/components/admin/AdminSignOutButton";

export const metadata = {
  title: "Coupon Management | Buzzora Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCouponsPage({ searchParams }) {
  const adminContext = await getAdminContext();

  if (!adminContext.authenticated) {
    redirect("/admin/login");
  }

  if (!adminContext.authorized) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-center items-center px-4 py-12">
        <div className="max-w-md w-full bg-stone-900 border border-red-900/60 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 bg-red-950/80 border border-red-800 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            !
          </div>
          <h1 className="text-xl font-semibold text-stone-100 mb-2">Access Denied</h1>
          <p className="text-sm text-stone-400 mb-6">
            The authenticated account (<span className="text-stone-300 font-mono">{adminContext.email}</span>) does not have administrator privileges.
          </p>
          <AdminSignOutButton className="w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl border border-stone-700 transition-colors" />
        </div>
      </div>
    );
  }

  // Preload initial coupons server-side
  let initialData = { coupons: [], pagination: { page: 1, pageSize: 25, totalCount: 0, totalPages: 1 } };
  try {
    initialData = await getAdminCoupons({
      page: parseInt(searchParams?.page || "1", 10),
      pageSize: parseInt(searchParams?.pageSize || "25", 10),
      search: searchParams?.search || "",
      status: searchParams?.status || "ALL",
      adminContext,
    });
  } catch (err) {
    console.error("[AdminCouponsPage] Error loading initial coupons:", err.message);
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-black">
      <AdminHeader adminContext={adminContext} currentSection="coupons" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-serif text-stone-100 tracking-tight">
            Coupon & Discount Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-400">
            Create, configure, monitor, and safely archive promotional discount codes.
          </p>
        </div>

        <CouponsManager initialData={initialData} />
      </main>
    </div>
  );
}
