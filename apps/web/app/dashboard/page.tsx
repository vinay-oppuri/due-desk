"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { authClient } from "../../lib/auth-client";

interface Business {
  id: string;
  name: string;
  state: string;
  business_type?: string;
  businessType?: string;
}

interface Obligation {
  id: string;
  businessId: string;
  businessName: string;
  businessState: string;
  formCode: string;
  formName: string;
  frequency: string;
  sourceUrl: string;
  periodLabel: string;
  dueDate: string;
  status: "pending" | "filed" | "late";
  daysRemaining: number;
  isDueSoon: boolean;
  isLate: boolean;
}

interface ObligationDetail extends Obligation {
  documentChecklist: string[];
  disclaimer: string;
  filingHistory: Array<{
    id: string;
    filedOn: string;
    notes: string;
    filedByName?: string;
    filedByEmail?: string;
  }>;
}

export default function DashboardPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>("");
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [viewMode, setViewMode] = useState<"all" | "30days" | "month">(
    "30days",
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Detail Modal state
  const [activeDetail, setActiveDetail] = useState<ObligationDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [filingNotes, setFilingNotes] = useState("");
  const [filingSuccess, setFilingSuccess] = useState(false);

  // Fetch businesses
  const loadBusinesses = async () => {
    try {
      const res = await fetch("/api/v1/businesses", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as Business[];
        setBusinesses(data);
        if (data.length > 0 && !selectedBizId) {
          setSelectedBizId(data[0]!.id);
        }
      }
    } catch {
      // Handled silently
    }
  };

  // Fetch obligations
  const loadObligations = async () => {
    setLoading(true);
    setError(null);
    try {
      let queryUrl = "/api/v1/obligations";
      const params = new URLSearchParams();
      if (selectedBizId) params.append("businessId", selectedBizId);
      if (viewMode === "30days") params.append("upcomingDays", "30");
      if (viewMode === "month") {
        const currentMonth = new Date().toISOString().slice(0, 7);
        params.append("month", currentMonth);
      }
      if (statusFilter !== "all") params.append("status", statusFilter);

      const qs = params.toString();
      if (qs) queryUrl += `?${qs}`;

      const res = await fetch(queryUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load compliance deadlines.");
      const data = (await res.json()) as Obligation[];
      setObligations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading deadlines.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    loadObligations();
  }, [selectedBizId, viewMode, statusFilter]);

  // Open obligation detail
  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setFilingSuccess(false);
    setFilingNotes("");
    try {
      const res = await fetch(`/api/v1/obligations/${id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as ObligationDetail;
        setActiveDetail(data);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  // Mark as Filed
  const handleMarkFiled = async () => {
    if (!activeDetail) return;
    try {
      const res = await fetch(`/api/v1/obligations/${activeDetail.id}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: filingNotes }),
      });

      if (res.ok) {
        setFilingSuccess(true);
        // Refresh detail & list
        await openDetail(activeDetail.id);
        await loadObligations();
      }
    } catch {
      // Handled
    }
  };

  // Metrics
  const dueSoonCount = obligations.filter(
    (o) => o.isDueSoon && o.status !== "filed",
  ).length;
  const overdueCount = obligations.filter(
    (o) => o.isLate && o.status !== "filed",
  ).length;
  const filedCount = obligations.filter((o) => o.status === "filed").length;
  const pendingCount = obligations.filter((o) => o.status === "pending").length;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-white selection:text-black">
      {/* Top Navbar */}
      <nav className="border-b border-neutral-900 bg-black/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-mono text-sm tracking-widest uppercase font-bold text-white"
            >
              DueDesk
            </Link>
            <span className="hidden sm:inline-block text-[11px] font-mono text-neutral-500 uppercase">
              Statutory Compliance Calendar
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/onboarding"
              className="py-1.5 px-3 text-xs font-mono uppercase bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 transition-colors"
            >
              + Add Business
            </Link>
            <button
              type="button"
              onClick={() => {
                window.open("/api/v1/calendar/feed.ics", "_blank");
              }}
              className="hidden sm:inline-flex items-center gap-2 py-1.5 px-3 text-xs font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              Sync .ICS
            </button>
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center gap-1 py-1.5 px-3 text-xs font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-teal-300 transition-colors"
            >
              Ops / Admin
            </Link>
            <Link
              href="/billing"
              className="hidden sm:inline-flex items-center gap-1 py-1.5 px-3 text-xs font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              Billing
            </Link>
            <button
              type="button"
              onClick={() =>
                authClient
                  .signOut()
                  .then(() => (window.location.href = "/auth"))
              }
              className="py-1.5 px-3 text-xs font-mono uppercase text-neutral-500 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-6xl w-full mx-auto px-4 py-8 flex-1">
        {businesses.length === 0 ? (
          /* Empty State: No businesses added yet */
          <div className="max-w-md mx-auto text-center border border-neutral-800 bg-neutral-950 p-8 my-12 shadow-2xl">
            <div className="w-12 h-12 border border-neutral-800 mx-auto flex items-center justify-center text-xl font-mono text-neutral-400 mb-4">
              📅
            </div>
            <h2 className="text-lg font-semibold text-white">
              No Business Profile Found
            </h2>
            <p className="text-xs text-neutral-400 font-mono mt-2 mb-6">
              Set up your business to automatically generate your personalized
              GST, TDS, PF, ESI, and state compliance calendar.
            </p>
            <Link
              href="/onboarding"
              className="block w-full py-3 bg-white text-black font-mono text-xs uppercase tracking-wider font-semibold hover:bg-neutral-200 transition-colors"
            >
              Set Up Business Profile
            </Link>
          </div>
        ) : (
          /* Compliance Calendar Active View */
          <div className="space-y-6">
            {/* Header with Business Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-900 pb-4">
              <div>
                <h1 className="text-xl font-semibold text-white tracking-tight">
                  Compliance Deadlines
                </h1>
                <p className="text-xs font-mono text-neutral-500 mt-0.5">
                  Track, verify, and complete statutory tax & filing
                  requirements.
                </p>
              </div>

              {businesses.length > 1 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-mono uppercase text-neutral-500">
                    Business:
                  </label>
                  <select
                    value={selectedBizId}
                    onChange={(e) => setSelectedBizId(e.target.value)}
                    className="px-2.5 py-1.5 bg-black border border-neutral-800 text-xs font-mono text-white focus:outline-none"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.state})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 border border-neutral-800 bg-neutral-950">
                <div className="text-[11px] font-mono uppercase text-neutral-500">
                  Upcoming (Total)
                </div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {obligations.length}
                </div>
              </div>
              <div className="p-4 border border-amber-900/40 bg-amber-950/20">
                <div className="text-[11px] font-mono uppercase text-amber-400">
                  Due Soon (&le; 7 Days)
                </div>
                <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
                  {dueSoonCount}
                </div>
              </div>
              <div className="p-4 border border-red-900/40 bg-red-950/20">
                <div className="text-[11px] font-mono uppercase text-red-400">
                  Overdue / Late
                </div>
                <div className="text-2xl font-bold font-mono text-red-300 mt-1">
                  {overdueCount}
                </div>
              </div>
              <div className="p-4 border border-emerald-900/40 bg-emerald-950/20">
                <div className="text-[11px] font-mono uppercase text-emerald-400">
                  Filed / Completed
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">
                  {filedCount}
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-neutral-900 pb-3">
              {/* Range Mode */}
              <div className="flex border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setViewMode("30days")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase transition-colors ${viewMode === "30days"
                      ? "bg-white text-black font-semibold"
                      : "bg-black text-neutral-400 hover:text-white"
                    }`}
                >
                  Next 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("month")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase transition-colors ${viewMode === "month"
                      ? "bg-white text-black font-semibold"
                      : "bg-black text-neutral-400 hover:text-white"
                    }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("all")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase transition-colors ${viewMode === "all"
                      ? "bg-white text-black font-semibold"
                      : "bg-black text-neutral-400 hover:text-white"
                    }`}
                >
                  Full FY
                </button>
              </div>

              {/* Status Pills */}
              <div className="flex items-center gap-1">
                {["all", "pending", "late", "filed"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 text-xs font-mono uppercase border transition-colors ${statusFilter === st
                        ? "border-white bg-white text-black font-medium"
                        : "border-neutral-800 bg-black text-neutral-400 hover:border-neutral-700"
                      }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Obligations Table / Cards */}
            {loading ? (
              <div className="text-center py-12 text-xs font-mono text-neutral-500">
                Loading compliance deadlines...
              </div>
            ) : obligations.length === 0 ? (
              <div className="text-center py-12 border border-neutral-900 bg-neutral-950/40 text-xs font-mono text-neutral-500">
                No statutory deadlines matching the selected filters.
              </div>
            ) : (
              <div className="border divide-y divide-neutral-900 bg-neutral-950">
                {obligations.map((item) => {
                  let badgeColor =
                    "bg-neutral-900 text-neutral-400 border-neutral-800";
                  let label = "Pending";

                  if (item.status === "filed") {
                    badgeColor =
                      "bg-emerald-950/60 text-emerald-300 border-emerald-800";
                    label = "Filed";
                  } else if (item.isLate) {
                    badgeColor = "bg-red-950/60 text-red-300 border-red-800";
                    label = `Late (${Math.abs(item.daysRemaining)}d ago)`;
                  } else if (item.isDueSoon) {
                    badgeColor =
                      "bg-amber-950/60 text-amber-300 border-amber-800";
                    label =
                      item.daysRemaining === 0
                        ? "Due Today"
                        : `Due in ${item.daysRemaining}d`;
                  } else {
                    label = `Due in ${item.daysRemaining}d`;
                  }

                  return (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-neutral-900/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-white tracking-wider px-2 py-0.5 bg-neutral-900 border border-neutral-800">
                            {item.formCode}
                          </span>
                          <span className="text-xs text-neutral-400 font-mono">
                            Period: {item.periodLabel}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-neutral-200">
                          {item.formName}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <div className="font-mono text-xs text-white">
                            {item.dueDate}
                          </div>
                          <span
                            className={`inline-block mt-0.5 text-[10px] font-mono uppercase px-1.5 py-0.5 border ${badgeColor}`}
                          >
                            {label}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => openDetail(item.id)}
                          className="py-1.5 px-3 text-xs font-mono uppercase bg-neutral-900 hover:bg-white hover:text-black border border-neutral-800 hover:border-white text-neutral-300 transition-colors cursor-pointer"
                        >
                          Checklist &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide-over Detail Modal */}
      {activeDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-lg bg-neutral-950 border-l border-neutral-800 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-neutral-800 pb-4">
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                    Statutory Filing
                  </span>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {activeDetail.formCode}
                  </h2>
                  <p className="text-xs font-mono text-neutral-400 mt-0.5">
                    {activeDetail.formName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDetail(null)}
                  className="text-xs font-mono uppercase px-2 py-1 text-neutral-400 hover:text-white border border-neutral-800"
                >
                  ✕ Close
                </button>
              </div>

              {/* Status info */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-black border border-neutral-800 font-mono text-xs">
                <div>
                  <span className="text-neutral-500 uppercase block text-[10px]">
                    Due Date
                  </span>
                  <span className="text-white font-bold">
                    {activeDetail.dueDate}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 uppercase block text-[10px]">
                    Status
                  </span>
                  <span
                    className={`font-bold uppercase ${activeDetail.status === "filed"
                        ? "text-emerald-400"
                        : activeDetail.isLate
                          ? "text-red-400"
                          : "text-amber-400"
                      }`}
                  >
                    {activeDetail.status}
                  </span>
                </div>
              </div>

              {/* Official Portal Button */}
              {activeDetail.sourceUrl && (
                <div>
                  <a
                    href={activeDetail.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full py-2.5 px-4 text-center text-xs font-mono uppercase tracking-wider bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 transition-colors"
                  >
                    Open Official Portal &nearr;
                  </a>
                </div>
              )}

              {/* Document Checklist */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                  Required Document Checklist
                </h3>
                <div className="border border-neutral-800 bg-black p-3 space-y-2">
                  {activeDetail.documentChecklist?.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs font-mono text-neutral-300"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-white rounded-none cursor-pointer"
                      />
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mark as Filed Section */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                  Filing Action
                </h3>
                {activeDetail.status === "filed" ? (
                  <div className="p-3 border border-emerald-900 bg-emerald-950/20 text-emerald-300 text-xs font-mono">
                    ✓ This obligation has been recorded as filed.
                  </div>
                ) : (
                  <div className="border border-neutral-800 bg-black p-4 space-y-3">
                    <label className="block text-xs font-mono text-neutral-400">
                      Filing Acknowledgement / Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={filingNotes}
                      onChange={(e) => setFilingNotes(e.target.value)}
                      placeholder="e.g. ARN 2912345678, Challan BSR 00213"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 text-xs font-mono text-white placeholder-neutral-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleMarkFiled}
                      className="w-full py-2.5 bg-white text-black font-mono text-xs uppercase tracking-wider font-semibold hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      Mark as Filed
                    </button>
                  </div>
                )}
              </div>

              {/* Filing History */}
              {activeDetail.filingHistory &&
                activeDetail.filingHistory.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                      Filing History
                    </h3>
                    <div className="border border-neutral-800 bg-black divide-y divide-neutral-900 font-mono text-xs">
                      {activeDetail.filingHistory.map((h) => (
                        <div key={h.id} className="p-3 space-y-1">
                          <div className="text-neutral-400 text-[11px]">
                            Filed on {new Date(h.filedOn).toLocaleDateString()}{" "}
                            by {h.filedByName || "User"}
                          </div>
                          <div className="text-neutral-200">{h.notes}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Statutory Disclaimer in drawer */}
            <div className="pt-6 border-t border-neutral-900 text-[11px] font-mono text-neutral-600">
              <p>
                Reminder tool, not tax advice. Verify dates with the official
                portal or your CA.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Statutory Footer */}
      <footer className="border-t border-neutral-900 bg-black py-4 px-4 text-center text-[11px] font-mono text-neutral-600">
        <p>
          Reminder tool, not tax advice. Verify dates with the official portal
          or your CA.
        </p>
      </footer>
    </main>
  );
}
