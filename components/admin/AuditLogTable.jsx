"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuditLogTable({ initialData }) {
  const router = useRouter();

  const [logs, setLogs] = useState(initialData?.logs || []);
  const [pagination, setPagination] = useState(initialData?.pagination || { page: 1, pageSize: 25, totalCount: 0, totalPages: 1 });

  // Filters
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("ALL");
  const [resourceType, setResourceType] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchLogs = async (targetPage = 1, currentSearch = search, currentAction = action, currentResource = resourceType) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pagination.pageSize || 25),
        search: currentSearch.trim(),
        action: currentAction,
        resourceType: currentResource,
      });

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/admin/login");
          return;
        }
        throw new Error(`Failed to load audit logs (HTTP ${res.status})`);
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: targetPage, pageSize: 25, totalCount: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || "Failed to load audit records.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1, search, action, resourceType);
  };

  const handleActionChange = (e) => {
    const val = e.target.value;
    setAction(val);
    fetchLogs(1, search, val, resourceType);
  };

  const handleResourceChange = (e) => {
    const val = e.target.value;
    setResourceType(val);
    fetchLogs(1, search, action, val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getActionBadge = (act) => {
    switch (act) {
      case "ADMIN_LOGIN_SUCCESS":
        return { label: "Login Success", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
      case "ADMIN_LOGIN_FAILURE":
        return { label: "Login Failure", class: "bg-red-500/10 text-red-400 border-red-500/20 font-semibold" };
      case "ADMIN_LOGOUT":
        return { label: "Logout", class: "bg-stone-500/10 text-stone-400 border-stone-500/20" };
      case "ADMIN_SESSION_REFRESH":
        return { label: "Session Refresh", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
      case "ADMIN_SESSION_REVOKED":
        return { label: "Session Revoked", class: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
      case "ORDER_STATUS_CHANGED":
        return { label: "Order Transition", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
      case "ORDER_SHIPPING_UPDATED":
        return { label: "Shipping Updated", class: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" };
      case "PAYMENT_RECONCILIATION_SUCCEEDED":
        return { label: "Payment Reconciled", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
      case "PAYMENT_RECONCILIATION_FAILED":
        return { label: "Reconciliation Failed", class: "bg-red-500/10 text-red-400 border-red-500/20" };
      case "PAYMENT_MISMATCH_DETECTED":
        return { label: "Payment Mismatch", class: "bg-rose-500/10 text-rose-300 border-rose-500/20 font-semibold" };
      default:
        return { label: act, class: "bg-stone-800 text-stone-300 border-stone-700" };
    }
  };

  const getResultBadge = (res) => {
    switch (res) {
      case "SUCCESS":
        return "bg-emerald-950/40 text-emerald-400 border-emerald-800/60";
      case "FAILURE":
        return "bg-red-950/40 text-red-400 border-red-800/60 font-semibold";
      case "CONFLICT":
        return "bg-amber-950/40 text-amber-300 border-amber-800/60 font-semibold";
      case "REJECTED":
        return "bg-purple-950/40 text-purple-300 border-purple-800/60";
      default:
        return "bg-stone-900 text-stone-400 border-stone-800";
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-4 backdrop-blur-md">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <input
              id="audit-search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit trail by administrator, resource ID, action, or reason..."
              className="w-full px-4 py-2 bg-stone-950/80 border border-stone-700/80 rounded-xl text-stone-100 placeholder-stone-500 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              id="audit-action-filter"
              value={action}
              onChange={handleActionChange}
              className="px-3 py-2 bg-stone-950 border border-stone-700/80 rounded-xl text-stone-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">Action: All Events</option>
              <option value="ADMIN_LOGIN_SUCCESS">Login Success</option>
              <option value="ADMIN_LOGIN_FAILURE">Login Failure</option>
              <option value="ADMIN_LOGOUT">Logout</option>
              <option value="ADMIN_SESSION_REFRESH">Session Refresh</option>
              <option value="ORDER_STATUS_CHANGED">Order Transition</option>
              <option value="ORDER_SHIPPING_UPDATED">Shipping Updated</option>
              <option value="PAYMENT_RECONCILIATION_SUCCEEDED">Payment Reconciled</option>
              <option value="PAYMENT_RECONCILIATION_FAILED">Reconciliation Failed</option>
              <option value="PAYMENT_MISMATCH_DETECTED">Payment Mismatch</option>
            </select>

            <select
              id="audit-resource-filter"
              value={resourceType}
              onChange={handleResourceChange}
              className="px-3 py-2 bg-stone-950 border border-stone-700/80 rounded-xl text-stone-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">Resource: All</option>
              <option value="session">Session / Auth</option>
              <option value="order">Order Operations</option>
              <option value="payment">Payment Operations</option>
              <option value="admin_user">Admin Users</option>
            </select>

            <button
              id="btn-filter-audit"
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? "Filtering..." : "Search"}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/60 text-stone-400 uppercase tracking-wider text-[10px] border-b border-stone-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                <th className="py-3.5 px-4 font-semibold">Administrator</th>
                <th className="py-3.5 px-4 font-semibold">Action</th>
                <th className="py-3.5 px-4 font-semibold">Resource</th>
                <th className="py-3.5 px-4 font-semibold">Result</th>
                <th className="py-3.5 px-4 font-semibold">State Change / Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-stone-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-stone-400">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-stone-400 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-stone-200 text-xs truncate max-w-[160px]" title={log.adminEmail}>
                          {log.adminEmail}
                        </div>
                        {log.adminUserId && (
                          <div className="text-[10px] text-stone-500 font-mono">
                            {log.adminUserId.slice(0, 8)}...
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] border uppercase tracking-wider ${badge.class}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-stone-200 text-xs truncate max-w-[160px]">
                          {log.resourceId || "—"}
                        </div>
                        <div className="text-[10px] text-stone-500 uppercase tracking-wider">
                          {log.resourceType || "system"}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border uppercase tracking-wider ${getResultBadge(log.result)}`}>
                          {log.result}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-stone-300 max-w-[300px]">
                        {log.previousState && log.newState ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-stone-400">{JSON.stringify(log.previousState)}</span>
                            <span className="text-amber-400">→</span>
                            <span className="text-stone-100 font-semibold">{JSON.stringify(log.newState)}</span>
                          </div>
                        ) : log.reason ? (
                          <div className="truncate text-stone-400 text-[11px]" title={log.reason}>
                            {log.reason}
                          </div>
                        ) : log.metadata ? (
                          <div className="font-mono text-[10px] text-stone-500 truncate" title={JSON.stringify(log.metadata)}>
                            {JSON.stringify(log.metadata)}
                          </div>
                        ) : (
                          <span className="text-stone-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="py-3 px-4 bg-stone-950/60 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
          <div>
            Showing Page <span className="font-semibold text-stone-200">{pagination.page}</span> of{" "}
            <span className="font-semibold text-stone-200">{pagination.totalPages}</span> (
            <span className="font-semibold text-stone-200">{pagination.totalCount}</span> total audit records)
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchLogs(pagination.page - 1)}
              className="px-3 py-1.5 bg-stone-900 border border-stone-800 rounded-lg hover:bg-stone-800 text-stone-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchLogs(pagination.page + 1)}
              className="px-3 py-1.5 bg-stone-900 border border-stone-800 rounded-lg hover:bg-stone-800 text-stone-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
