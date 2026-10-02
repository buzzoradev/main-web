"use client";

import { useState, useEffect, useCallback } from "react";

function formatCurrency(amount) {
  if (amount == null) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(isoString) {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

function getStatusBadge(coupon) {
  if (!coupon.isActive) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-stone-800 text-stone-400 border border-stone-700">
        Inactive
      </span>
    );
  }

  const now = Date.now();
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-red-950/60 text-red-400 border border-red-800/80">
        Expired
      </span>
    );
  }

  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-amber-950/60 text-amber-300 border border-amber-800/80">
        Scheduled
      </span>
    );
  }

  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-amber-950/60 text-amber-300 border border-amber-800/80">
        Exhausted
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
      Active
    </span>
  );
}

export default function CouponsManager({ initialData }) {
  const [coupons, setCoupons] = useState(initialData?.coupons || []);
  const [pagination, setPagination] = useState(
    initialData?.pagination || { page: 1, pageSize: 25, totalCount: 0, totalPages: 1 }
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [deleteConfirmCoupon, setDeleteConfirmCoupon] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    code: "",
    discountPercent: "",
    minimumOrderAmount: "0",
    maximumDiscountAmount: "",
    startsAt: "",
    expiresAt: "",
    usageLimit: "",
    isActive: true,
  });

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
        search,
        status: statusFilter,
      });

      const res = await fetch(`/api/admin/coupons?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load coupons");

      setCoupons(data.coupons || []);
      setPagination(data.pagination || { page: 1, pageSize: 25, totalCount: 0, totalPages: 1 });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData({
      code: "",
      discountPercent: "",
      minimumOrderAmount: "0",
      maximumDiscountAmount: "",
      startsAt: "",
      expiresAt: "",
      usageLimit: "",
      isActive: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discountPercent: String(coupon.discountPercent),
      minimumOrderAmount: String(coupon.minimumOrderAmount || 0),
      maximumDiscountAmount: coupon.maximumDiscountAmount != null ? String(coupon.maximumDiscountAmount) : "",
      startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 16) : "",
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : "",
      usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : "",
      isActive: coupon.isActive,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        discountPercent: Number(formData.discountPercent),
        minimumOrderAmount: formData.minimumOrderAmount !== "" ? Number(formData.minimumOrderAmount) : 0,
        maximumDiscountAmount: formData.maximumDiscountAmount !== "" ? Number(formData.maximumDiscountAmount) : null,
        startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : null,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        usageLimit: formData.usageLimit !== "" ? parseInt(formData.usageLimit, 10) : null,
        isActive: Boolean(formData.isActive),
      };

      const url = editingCoupon ? `/api/admin/coupons/${editingCoupon.id}` : "/api/admin/coupons";
      const method = editingCoupon ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save coupon.");

      setIsModalOpen(false);
      setActionSuccess(
        editingCoupon ? `Coupon ${payload.code} updated successfully.` : `Coupon ${payload.code} created successfully.`
      );
      fetchCoupons();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const toggleCouponStatus = async (coupon) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");

      setActionSuccess(`Coupon ${coupon.code} is now ${!coupon.isActive ? "Active" : "Disabled"}.`);
      fetchCoupons();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmCoupon) return;
    setFormSubmitting(true);
    try {
      const res = await fetch(`/api/admin/coupons/${deleteConfirmCoupon.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete coupon.");

      setDeleteConfirmCoupon(null);
      setActionSuccess(data.message || `Coupon ${deleteConfirmCoupon.code} safely archived.`);
      fetchCoupons();
    } catch (err) {
      setActionError(err.message);
      setDeleteConfirmCoupon(null);
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm flex items-center justify-between">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm flex items-center justify-between">
          <span>⚠️ {actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-200">
            ✕
          </button>
        </div>
      )}

      {/* Control Bar: Search, Status Filter, Create Button */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by coupon code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/50"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
            <option value="EXPIRED">Expired Only</option>
          </select>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-accent py-2 px-4 text-xs font-semibold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5"
        >
          <span>+</span> Create Coupon
        </button>
      </div>

      {/* Main Coupons Table */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-900 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
              <tr>
                <th scope="col" className="py-3 px-4">Coupon Code</th>
                <th scope="col" className="py-3 px-4">Discount</th>
                <th scope="col" className="py-3 px-4">Status</th>
                <th scope="col" className="py-3 px-4">Usage</th>
                <th scope="col" className="py-3 px-4">Min. Order</th>
                <th scope="col" className="py-3 px-4">Max. Discount</th>
                <th scope="col" className="py-3 px-4">Valid Window</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/80">
              {loading && coupons.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-stone-500">
                    Loading coupons…
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-stone-500">
                    No coupons found matching your criteria. Click &quot;+ Create Coupon&quot; to add one.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400 text-sm tracking-wide">
                      {c.code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-stone-200">
                      {c.discountPercent}% OFF
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(c)}</td>
                    <td className="py-3.5 px-4 font-mono text-stone-300">
                      <span className="font-semibold text-stone-100">{c.usageCount}</span>
                      <span className="text-stone-500"> / {c.usageLimit != null ? c.usageLimit : "∞"}</span>
                    </td>
                    <td className="py-3.5 px-4 text-stone-400">
                      {c.minimumOrderAmount > 0 ? formatCurrency(c.minimumOrderAmount) : "None"}
                    </td>
                    <td className="py-3.5 px-4 text-stone-400">
                      {c.maximumDiscountAmount != null ? formatCurrency(c.maximumDiscountAmount) : "No Cap"}
                    </td>
                    <td className="py-3.5 px-4 text-stone-400 whitespace-nowrap text-[11px]">
                      {c.startsAt || c.expiresAt ? (
                        <div>
                          <div>{c.startsAt ? formatDate(c.startsAt) : "Immediate"}</div>
                          <div className="text-stone-500">to {c.expiresAt ? formatDate(c.expiresAt) : "Never"}</div>
                        </div>
                      ) : (
                        <span className="text-stone-500">Always Valid</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => openEditModal(c)}
                        className="px-2.5 py-1 text-xs font-medium text-stone-300 bg-stone-800 hover:bg-stone-700 rounded-lg border border-stone-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleCouponStatus(c)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                          c.isActive
                            ? "text-amber-300 bg-amber-950/40 border-amber-800/60 hover:bg-amber-900/60"
                            : "text-emerald-300 bg-emerald-950/40 border-emerald-800/60 hover:bg-emerald-900/60"
                        }`}
                      >
                        {c.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmCoupon(c)}
                        className="px-2.5 py-1 text-xs font-medium text-red-400 bg-red-950/40 hover:bg-red-900/60 rounded-lg border border-red-800/60 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <h2 className="font-serif text-xl text-stone-100">
                {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : "Create New Coupon"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-200 text-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-400 uppercase font-semibold text-[10px] tracking-wider mb-1">
                  Coupon Code <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BUZZORA10"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-stone-100 font-mono tracking-wider focus:outline-none focus:border-amber-500/50 uppercase"
                />
                <p className="mt-1 text-[11px] text-stone-500">
                  Case-insensitive. Normalized to uppercase automatically.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-400 uppercase font-semibold text-[10px] tracking-wider mb-1">
                    Discount Percentage (%) <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    required
                    placeholder="10"
                    value={formData.discountPercent}
                    onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-stone-400 uppercase font-semibold text-[10px] tracking-wider mb-1">
                    Usage Limit (Max Uses)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Unlimited"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-400 uppercase font-semibold text-[10px] tracking-wider mb-1">
                    Min. Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={formData.minimumOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minimumOrderAmount: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-stone-400 uppercase font-semibold text-[10px] tracking-wider mb-1">
                    Max. Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="No Cap"
                    value={formData.maximumDiscountAmount}
                    onChange={(e) => setFormData({ ...formData, maximumDiscountAmount: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-400 uppercase font-semibold text-[10px] tracking-wider mb-1">
                    Valid From (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-stone-400 uppercase font-semibold text-[10px] tracking-wider mb-1">
                    Expires At (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-stone-700 bg-stone-950 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-stone-300 font-medium">Coupon is Active</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="btn-accent px-6 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider disabled:opacity-60"
                >
                  {formSubmitting ? "Saving…" : editingCoupon ? "Save Changes" : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Safe Archive Confirmation Modal */}
      {deleteConfirmCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-stone-900 border border-red-900/60 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-red-950/80 border border-red-800 text-red-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              🗑️
            </div>
            <h3 className="text-center font-serif text-lg text-stone-100">
              Safe Delete Coupon {deleteConfirmCoupon.code}
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed text-center">
              Are you sure you want to remove this coupon? If historical orders used this coupon, it will be safely archived so past order snapshots and financial records remain intact.
            </p>

            <div className="pt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmCoupon(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={formSubmitting}
                onClick={handleDelete}
                className="px-5 py-2 bg-red-800 hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition-colors disabled:opacity-60"
              >
                {formSubmitting ? "Removing…" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
