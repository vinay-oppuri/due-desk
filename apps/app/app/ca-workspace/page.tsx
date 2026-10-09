"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { authClient } from "../../lib/auth-client";

interface FirmDetails {
  organization: {
    id: string;
    name: string;
    type: "business" | "ca_firm";
  };
  clientCount: number;
  staffCount: number;
  isCaFirm: boolean;
}

interface StaffMember {
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface BoardSummary {
  totalClients: number;
  totalPending: number;
  dueThisWeek: number;
  overdueCount: number;
  filedCount: number;
}

interface BoardItem {
  id: string;
  periodLabel: string;
  dueDate: string;
  status: "pending" | "filed" | "late";
  daysRemaining: number;
  isDueSoon: boolean;
  isLate: boolean;
  business: {
    id: string;
    name: string;
    state: string;
    businessType: string;
  };
  rule: {
    id: string;
    formCode: string;
    name: string;
    sourceUrl?: string;
  };
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface ImportPreviewData {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    name: string;
    field: string;
    reason: string;
  }>;
  preview: Array<{
    row: number;
    name: string;
    state: string;
    businessType: string;
    turnoverBracket: string;
    hasEmployees: boolean;
    gstin: string | null;
    panLast4: string | null;
    registrations: Record<string, boolean>;
    agmDate: string;
  }>;
  planLimitInfo: {
    currentBusinesses: number;
    maxBusinesses: number;
    canImportAll: boolean;
    allowedToImport: number;
  };
}

const SAMPLE_CSV = `name,state,businessType,turnoverBracket,hasEmployees,gstin,registrations
Acme Corp Pvt Ltd,KA,pvt_ltd,1.5Cr-5Cr,true,29ABCDE1234F1Z5,gst;pf;esi;pt
Nova Tech LLP,MH,llp,<40L,false,,pt
BluePeak Retail,DL,pvt_ltd,40L-1.5Cr,true,07AAAAA0000A1Z5,gst;pt`;

export default function CaWorkspacePage() {
  const { data: session } = authClient.useSession();

  const [firm, setFirm] = useState<FirmDetails | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);
  const [summary, setSummary] = useState<BoardSummary>({
    totalClients: 0,
    totalPending: 0,
    dueThisWeek: 0,
    overdueCount: 0,
    filedCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Filters
  const [timeframe, setTimeframe] = useState<"this_week" | "this_month" | "overdue" | "all">("this_week");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvInput, setCsvInput] = useState(SAMPLE_CSV);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [digestPreview, setDigestPreview] = useState<any | null>(null);
  const [isSendingDigest, setIsSendingDigest] = useState(false);

  const fetchFirmData = async () => {
    try {
      const [fRes, sRes] = await Promise.all([
        fetch("/api/ca/firm"),
        fetch("/api/ca/staff"),
      ]);
      if (fRes.ok) {
        const fData = await fRes.json();
        setFirm(fData);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setStaff(sData);
      }
    } catch (err) {
      console.error("Error fetching firm details:", err);
    }
  };

  const fetchBoardData = async () => {
    setLoading(true);
    try {
      let url = `/api/ca/board?timeframe=${timeframe}`;
      if (selectedClient !== "all") url += `&clientId=${selectedClient}`;
      if (selectedAssignee !== "all") url += `&assigneeId=${selectedAssignee}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBoardItems(data.items || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch (err) {
      console.error("Error fetching board items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFirmData();
  }, []);

  useEffect(() => {
    fetchBoardData();
  }, [timeframe, selectedClient, selectedAssignee]);

  const handleAssign = async (obligationId: string, assigneeId: string) => {
    try {
      const val = assigneeId === "unassigned" ? null : assigneeId;
      const res = await fetch(`/api/ca/obligations/${obligationId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: val }),
      });
      if (res.ok) {
        fetchBoardData();
      }
    } catch (err) {
      console.error("Error assigning obligation:", err);
    }
  };

  const handlePreviewCsv = async () => {
    setIsImporting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ca/clients/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent: csvInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || "Failed to validate CSV");
      } else {
        setImportPreview(data);
      }
    } catch (err: any) {
      setMessage(err.message || "Network error validating CSV");
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || !importPreview.preview.length) return;
    setIsImporting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ca/clients/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients: importPreview.preview }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || "Failed to import clients");
      } else {
        setMessage(`Success! Imported ${data.importedCount} clients with ${data.obligationsGenerated} obligations.`);
        setIsImportModalOpen(false);
        setImportPreview(null);
        fetchFirmData();
        fetchBoardData();
      }
    } catch (err: any) {
      setMessage(err.message || "Network error confirming import");
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenDigestModal = async () => {
    setIsDigestModalOpen(true);
    try {
      const res = await fetch("/api/ca/digest/preview");
      if (res.ok) {
        const data = await res.json();
        setDigestPreview(data);
      }
    } catch (err) {
      console.error("Error loading digest preview:", err);
    }
  };

  const handleSendDigest = async () => {
    setIsSendingDigest(true);
    try {
      const res = await fetch("/api/ca/digest/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session?.user?.email }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Consolidated digest sent to ${data.recipientEmail} (${data.totalDeadlinesIncluded} deadlines included).`);
        setIsDigestModalOpen(false);
      } else {
        setMessage(data.message || "Failed to send digest");
      }
    } catch (err: any) {
      setMessage(err.message || "Error sending digest");
    } finally {
      setIsSendingDigest(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-200 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="border-b border-neutral-900 bg-black/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-bold tracking-tight text-white hover:text-sky-400 transition-colors">
              DueDesk
            </Link>
            <span className="text-neutral-700">/</span>
            <span className="px-2 py-0.5 text-[11px] font-mono uppercase bg-sky-950/70 border border-sky-800/80 text-sky-400 rounded">
              CA Workspace
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="py-1.5 px-3 text-xs font-mono uppercase bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-300 transition-colors"
            >
              Calendar
            </Link>
            <Link
              href="/billing"
              className="py-1.5 px-3 text-xs font-mono uppercase bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-300 transition-colors"
            >
              Billing
            </Link>
            <Link
              href="/admin"
              className="py-1.5 px-3 text-xs font-mono uppercase bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-300 transition-colors"
            >
              Admin
            </Link>
            <button
              type="button"
              onClick={() =>
                authClient
                  .signOut()
                  .then(
                    () =>
                      (window.location.href = `${process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000"}/auth`),
                  )
              }
              className="py-1.5 px-3 text-xs font-mono uppercase text-neutral-500 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 py-8 flex-1 space-y-6">
        {/* Banner with Firm Profile and Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-neutral-950 border border-neutral-800 p-6 rounded-lg">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {firm?.organization.name || "CA Firm Workspace"}
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 rounded">
                Multi-Client Active
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-400 mt-1">
              Centralized statutory compliance control for {firm?.clientCount || 0} client companies &bull; {firm?.staffCount || 1} team members.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="py-2 px-4 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded flex items-center gap-2 transition-colors shadow-lg shadow-sky-950"
            >
              <span>+ Bulk Import Clients</span>
            </button>
            <button
              onClick={handleOpenDigestModal}
              className="py-2 px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-semibold rounded flex items-center gap-2 transition-colors"
            >
              <span>📑 Send Weekly Digest</span>
            </button>
          </div>
        </div>

        {message && (
          <div className="p-3 bg-neutral-900 border border-sky-800 text-sky-300 text-xs font-mono rounded flex justify-between items-center">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-neutral-500 hover:text-white">✕</button>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded">
            <div className="text-[11px] font-mono uppercase text-neutral-500">Total Managed Clients</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalClients}</div>
          </div>
          <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded">
            <div className="text-[11px] font-mono uppercase text-amber-400">Due This Week (&le; 7 Days)</div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-1">{summary.dueThisWeek}</div>
          </div>
          <div className="p-4 bg-red-950/20 border border-red-900/40 rounded">
            <div className="text-[11px] font-mono uppercase text-red-400">Overdue / Late Filings</div>
            <div className="text-2xl font-bold font-mono text-red-300 mt-1">{summary.overdueCount}</div>
          </div>
          <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded">
            <div className="text-[11px] font-mono uppercase text-emerald-400">Completed / Filed</div>
            <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">{summary.filedCount}</div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-950 border border-neutral-800 p-4 rounded">
          {/* Timeframe Buttons */}
          <div className="flex items-center gap-1.5">
            {[
              { id: "this_week", label: "This Week" },
              { id: "this_month", label: "This Month" },
              { id: "overdue", label: "Overdue" },
              { id: "all", label: "All Deadlines" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setTimeframe(btn.id as any)}
                className={`py-1 px-3 text-xs font-mono rounded transition-colors ${
                  timeframe === btn.id
                    ? "bg-sky-600 text-white font-semibold"
                    : "bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Selectors */}
          <div className="flex items-center gap-3">
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="px-3 py-1.5 bg-black border border-neutral-800 text-xs font-mono text-neutral-300 rounded focus:outline-none"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned Only</option>
              {staff.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.email} ({m.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Deadline Board Table */}
        <div className="border border-neutral-800 rounded bg-neutral-950 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs font-mono text-neutral-500">
              Loading multi-client compliance deadlines...
            </div>
          ) : boardItems.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 space-y-2">
              <div className="text-sm font-semibold text-neutral-400">No deadlines match selected filters</div>
              <p className="text-xs font-mono text-neutral-600">
                Try switching timeframe to "All Deadlines" or importing client records.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-900/80 border-b border-neutral-800 text-neutral-400 font-mono uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Client Company</th>
                    <th className="py-3 px-4">Form</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Staff</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {boardItems.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{item.business.name}</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-400 rounded">
                            {item.business.state}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-400">
                        {item.rule.formCode}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400 font-mono">
                        {item.periodLabel}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-white">{item.dueDate}</div>
                        <div className="text-[10px] text-neutral-500">
                          {item.daysRemaining < 0
                            ? `${Math.abs(item.daysRemaining)} days overdue`
                            : item.daysRemaining === 0
                            ? "Due today"
                            : `Due in ${item.daysRemaining} days`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                            item.status === "filed"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : item.isLate
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : item.isDueSoon
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : "bg-neutral-900 text-neutral-400 border border-neutral-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={item.assignedTo?.id || "unassigned"}
                          onChange={(e) => handleAssign(item.id, e.target.value)}
                          className="px-2 py-1 bg-black border border-neutral-800 text-[11px] font-mono text-neutral-300 rounded focus:outline-none"
                        >
                          <option value="unassigned">Unassigned</option>
                          {staff.map((s) => (
                            <option key={s.userId} value={s.userId}>
                              {s.name || s.email}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/dashboard`}
                          className="text-[11px] font-mono text-sky-400 hover:text-sky-300 transition-colors"
                        >
                          View Details &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* CSV Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Bulk Import Client Companies (CSV)</h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Dry-run preview validates columns and format before creating records.
                </p>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-neutral-500 hover:text-white">✕</button>
            </div>

            {!importPreview ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-mono text-neutral-400 uppercase">CSV Content</label>
                    <button
                      onClick={() => setCsvInput(SAMPLE_CSV)}
                      className="text-xs font-mono text-sky-400 hover:text-sky-300"
                    >
                      Load Sample Template
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded p-3 font-mono text-xs text-neutral-200 focus:outline-none focus:border-sky-600"
                    placeholder="name,state,businessType,turnoverBracket,hasEmployees,gstin,registrations..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsImportModalOpen(false)}
                    className="py-2 px-4 bg-neutral-900 hover:bg-neutral-800 text-xs font-mono text-neutral-300 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePreviewCsv}
                    disabled={isImporting}
                    className="py-2 px-4 bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white rounded transition-colors disabled:opacity-50"
                  >
                    {isImporting ? "Validating..." : "Validate & Preview (Dry-Run)"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-neutral-900/60 p-3 rounded border border-neutral-800 text-xs font-mono">
                  <div>Total Rows: <span className="font-bold text-white">{importPreview.totalRows}</span></div>
                  <div>Valid: <span className="font-bold text-emerald-400">{importPreview.validCount}</span></div>
                  <div>Errors: <span className="font-bold text-red-400">{importPreview.errorCount}</span></div>
                </div>

                {importPreview.errors.length > 0 && (
                  <div className="p-3 bg-red-950/30 border border-red-900/50 rounded space-y-1 text-xs">
                    <div className="font-bold text-red-400 font-mono">Validation Errors Detected:</div>
                    {importPreview.errors.map((err, i) => (
                      <div key={i} className="text-red-300 text-[11px] font-mono">
                        Row {err.row} ({err.name}): {err.reason}
                      </div>
                    ))}
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto border border-neutral-800 rounded">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-900 text-neutral-400 font-mono text-[10px]">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2">State</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">GSTIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 font-mono text-[11px]">
                      {importPreview.preview.map((c, i) => (
                        <tr key={i}>
                          <td className="p-2 text-white">{c.name}</td>
                          <td className="p-2">{c.state}</td>
                          <td className="p-2">{c.businessType}</td>
                          <td className="p-2 text-sky-400">{c.gstin || "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setImportPreview(null)}
                    className="py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-xs font-mono text-neutral-400 rounded"
                  >
                    &larr; Back to CSV Editor
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting || importPreview.validCount === 0}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded transition-colors disabled:opacity-50"
                  >
                    {isImporting ? "Importing..." : `Confirm & Import (${importPreview.validCount} Clients)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weekly Digest Modal */}
      {isDigestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Consolidated Weekly Compliance Digest</h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Sends 1 single executive email with all client deadlines.
                </p>
              </div>
              <button onClick={() => setIsDigestModalOpen(false)} className="text-neutral-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-neutral-900 rounded border border-neutral-800 text-xs font-mono space-y-1">
                <div>Recipient: <span className="text-white font-bold">{session?.user?.email}</span></div>
                <div>Total Deadlines: <span className="text-sky-400 font-bold">{digestPreview?.totalCount || 0}</span></div>
                <div>Overdue Items: <span className="text-red-400 font-bold">{digestPreview?.overdueCount || 0}</span></div>
                <div>Due This Week: <span className="text-amber-400 font-bold">{digestPreview?.dueSoonCount || 0}</span></div>
              </div>

              <p className="text-[11px] text-neutral-500">
                This replaces sending individual emails per client, protecting your free-tier email limit and avoiding inbox overflow.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsDigestModalOpen(false)}
                className="py-2 px-4 bg-neutral-900 hover:bg-neutral-800 text-xs font-mono text-neutral-300 rounded"
              >
                Close
              </button>
              <button
                onClick={handleSendDigest}
                disabled={isSendingDigest}
                className="py-2 px-4 bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white rounded transition-colors disabled:opacity-50"
              >
                {isSendingDigest ? "Sending..." : "Send Consolidated Digest Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-600 font-mono">
        Statutory Disclaimer: Reminder tool, not tax advice. Verify dates with the official portal or your CA.
      </footer>
    </div>
  );
}
