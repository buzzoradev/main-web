import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminAuditLogs } from "@/lib/admin/audit";
import AdminHeader from "@/components/admin/AdminHeader";
import AuditLogTable from "@/components/admin/AuditLogTable";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ searchParams }) {
  let adminContext;
  try {
    adminContext = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }

  const page = searchParams?.page || 1;
  const action = searchParams?.action || "ALL";
  const resourceType = searchParams?.resourceType || "ALL";
  const search = searchParams?.search || "";

  let initialData = { logs: [], pagination: { page: 1, pageSize: 25, totalCount: 0, totalPages: 1 } };
  try {
    initialData = await getAdminAuditLogs({
      page,
      pageSize: 25,
      action,
      resourceType,
      search,
      adminContext,
    });
  } catch (err) {
    console.error("[AdminAuditPage] Error loading audit logs:", err.message);
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      <AdminHeader adminContext={adminContext} currentSection="audit" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-stone-100">
              Operational Audit Trail
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              Append-only security log recording administrative logins, order fulfillment transitions, and payment reconciliation events.
            </p>
          </div>
        </div>

        <AuditLogTable initialData={initialData} />
      </main>
    </div>
  );
}
