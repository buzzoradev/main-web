import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminPaymentsList } from "@/lib/admin/payments";
import AdminHeader from "@/components/admin/AdminHeader";
import PaymentsTable from "@/components/admin/PaymentsTable";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({ searchParams }) {
  let adminContext;
  try {
    adminContext = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }

  const page = searchParams?.page || 1;
  const search = searchParams?.search || "";
  const paymentStatus = searchParams?.paymentStatus || "ALL";
  const reconciliationFilter = searchParams?.reconciliationFilter || "ALL";

  let initialData = { payments: [], pagination: { page: 1, pageSize: 25, totalCount: 0, totalPages: 1 } };
  try {
    initialData = await getAdminPaymentsList({
      page,
      pageSize: 25,
      search,
      paymentStatus,
      reconciliationFilter,
      adminContext,
    });
  } catch (err) {
    console.error("[AdminPaymentsPage] Error loading initial payments:", err.message);
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      <AdminHeader adminContext={adminContext} currentSection="payments" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-stone-100">
              Payment Operations & Reconciliation
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              Authoritative transaction audit, PhonePe gateway consistency check, and multi-attempt tracking.
            </p>
          </div>
        </div>

        <PaymentsTable initialData={initialData} />
      </main>
    </div>
  );
}
