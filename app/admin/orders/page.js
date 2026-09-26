import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/auth";
import { getAdminOrdersList } from "@/lib/admin/orders";
import AdminHeader from "@/components/admin/AdminHeader";
import OrdersTable from "@/components/admin/OrdersTable";
import AdminSignOutButton from "@/components/admin/AdminSignOutButton";

export const metadata = {
  title: "Order Management | Buzzora Admin",
  robots: { index: false, follow: false },
};

export default async function AdminOrdersPage({ searchParams }) {
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

  // Preload initial orders server-side
  let initialData = { orders: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 1 };
  try {
    initialData = await getAdminOrdersList({
      page: parseInt(searchParams?.page || "1", 10),
      pageSize: parseInt(searchParams?.pageSize || "20", 10),
      search: searchParams?.search || "",
      orderStatus: searchParams?.orderStatus || "ALL",
      paymentStatus: searchParams?.paymentStatus || "ALL",
      adminContext,
    });
  } catch (err) {
    console.error("[AdminOrdersPage] Error loading initial orders:", err.message);
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-black">
      <AdminHeader adminContext={adminContext} currentSection="orders" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-serif text-stone-100 tracking-tight">
            Order Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-400">
            Search, filter, and process customer shipments and fulfillment lifecycle.
          </p>
        </div>

        <OrdersTable initialData={initialData} />
      </main>
    </div>
  );
}
