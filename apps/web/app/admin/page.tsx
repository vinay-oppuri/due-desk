"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { authClient } from "../../lib/auth-client";

interface UsageMetrics {
  resend: {
    usedToday: number;
    dailyCap: number;
    percentUsed: number;
    status: "healthy" | "warning" | "critical";
  };
  database: {
    usedBytes: number;
    formattedUsed: string;
    freeTierBytes: number;
    formattedLimit: string;
    percentUsed: number;
    status: "healthy" | "warning" | "critical";
  };
  storage: {
    usedBytes: number;
    formattedUsed: string;
    freeTierBytes: number;
    formattedLimit: string;
    percentUsed: number;
    status: "healthy" | "warning" | "critical";
  };
  systemAlerts: string[];
  checkedAt: string;
}

interface DeadReminder {
  id: string;
  organizationId: string;
  obligationId: string;
  channel: string;
  offsetDays: number;
  sendAt: string;
  state: string;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
  businessName: string;
  dueDate: string;
  periodLabel: string;
}

interface DeliveryFailure {
  id: string;
  reminderId: string;
  attemptAt: string;
  result: string;
  providerId: string | null;
  error: string | null;
}

interface UnverifiedRule {
  id: string;
  formCode: string;
  name: string;
  frequency: string;
  sourceUrl: string;
  version: number;
  verified: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export default function AdminObservabilityPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const [activeTab, setActiveTab] = useState<"dlq" | "failures" | "unverified" | "audit">("dlq");
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [deadReminders, setDeadReminders] = useState<DeadReminder[]>([]);
  const [failures, setFailures] = useState<DeliveryFailure[]>([]);
  const [unverifiedRules, setUnverifiedRules] = useState<UnverifiedRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Metrics
      const mRes = await fetch("/api/v1/observability/metrics", { credentials: "include" });
      if (mRes.ok) {
        const mData = await mRes.json();
        setMetrics(mData);
      }

      // 2. Dead reminders
      const dRes = await fetch("/api/v1/observability/dead-reminders", { credentials: "include" });
      if (dRes.ok) {
        const dData = await dRes.json();
        setDeadReminders(dData);
      }

      // 3. Failures
      const fRes = await fetch("/api/v1/observability/failed-deliveries", { credentials: "include" });
      if (fRes.ok) {
        const fData = await fRes.json();
        setFailures(fData);
      }

      // 4. Unverified rules
      const uRes = await fetch("/api/v1/observability/unverified-rules", { credentials: "include" });
      if (uRes.ok) {
        const uData = await uRes.json();
        setUnverifiedRules(uData);
      }
    } catch (err: any) {
      console.error("Failed to load admin observability data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleRetryReminder = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/v1/observability/dead-reminders/${id}/retry`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setMessage(`Reminder ${id} requeued to pending successfully.`);
        await fetchAdminData();
      } else {
        setMessage(`Failed to retry reminder.`);
      }
    } catch (err: any) {
      setMessage(`Error retrying reminder: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunHealthCheck = async () => {
    setActionLoading("health-check");
    try {
      const res = await fetch("/api/v1/observability/usage-check", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Usage check completed: ${data.alertCount} alert(s) logged.`);
        await fetchAdminData();
      }
    } catch (err: any) {
      setMessage(`Error running usage check: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
                DueDesk
              </span>
            </Link>
            <span className="text-xs bg-purple-900/60 text-purple-300 font-semibold px-2.5 py-0.5 rounded-full border border-purple-700">
              Operations & Observability
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-sm text-slate-400 hover:text-slate-200 transition"
            >
              ← Back to Calendar
            </Link>
            <button
              onClick={handleRunHealthCheck}
              disabled={actionLoading === "health-check"}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition shadow flex items-center space-x-1"
            >
              <span>{actionLoading === "health-check" ? "Checking..." : "Run Usage Check"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
        {message && (
          <div className="p-4 rounded-xl bg-blue-900/40 border border-blue-700/60 text-blue-200 text-sm flex justify-between items-center">
            <span>{message}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-xs text-blue-300 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Free Tier Quota Usage Overview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-200">
              Free Tier Quotas & Budget Guard (70% Warning Threshold)
            </h2>
            <span className="text-xs text-slate-400">
              Zero-Spend Infrastructure Protection
            </span>
          </div>

          {metrics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Resend Emails */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">Resend Emails Today</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      metrics.resend.status === "critical"
                        ? "bg-red-900/60 text-red-300 border border-red-700"
                        : metrics.resend.status === "warning"
                          ? "bg-amber-900/60 text-amber-300 border border-amber-700"
                          : "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                    }`}
                  >
                    {metrics.resend.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {metrics.resend.usedToday}{" "}
                  <span className="text-sm font-normal text-slate-400">
                    / {metrics.resend.dailyCap} cap
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      metrics.resend.percentUsed >= 90
                        ? "bg-red-500"
                        : metrics.resend.percentUsed >= 70
                          ? "bg-amber-500"
                          : "bg-teal-500"
                    }`}
                    style={{ width: `${Math.min(100, metrics.resend.percentUsed)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{metrics.resend.percentUsed}% consumed</span>
                  <span>10 reserved for auth OTPs</span>
                </div>
              </div>

              {/* Neon DB Storage */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">Neon PostgreSQL DB</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      metrics.database.status === "critical"
                        ? "bg-red-900/60 text-red-300 border border-red-700"
                        : metrics.database.status === "warning"
                          ? "bg-amber-900/60 text-amber-300 border border-amber-700"
                          : "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                    }`}
                  >
                    {metrics.database.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {metrics.database.formattedUsed}{" "}
                  <span className="text-sm font-normal text-slate-400">
                    / {metrics.database.formattedLimit}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      metrics.database.percentUsed >= 90
                        ? "bg-red-500"
                        : metrics.database.percentUsed >= 70
                          ? "bg-amber-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, metrics.database.percentUsed))}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{metrics.database.percentUsed}% free tier limit</span>
                  <span>Serverless Neon</span>
                </div>
              </div>

              {/* Cloudflare R2 Storage */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">Cloudflare R2 Storage</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      metrics.storage.status === "critical"
                        ? "bg-red-900/60 text-red-300 border border-red-700"
                        : metrics.storage.status === "warning"
                          ? "bg-amber-900/60 text-amber-300 border border-amber-700"
                          : "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                    }`}
                  >
                    {metrics.storage.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {metrics.storage.formattedUsed}{" "}
                  <span className="text-sm font-normal text-slate-400">
                    / {metrics.storage.formattedLimit}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      metrics.storage.percentUsed >= 90
                        ? "bg-red-500"
                        : metrics.storage.percentUsed >= 70
                          ? "bg-amber-500"
                          : "bg-indigo-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(1, metrics.storage.percentUsed))}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{metrics.storage.percentUsed}% of 10GB free tier</span>
                  <span>Private R2 Bucket</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-sm">
              Loading resource quotas...
            </div>
          )}
        </section>

        {/* Tab Navigation */}
        <section className="space-y-4">
          <div className="flex border-b border-slate-800 space-x-6">
            <button
              onClick={() => setActiveTab("dlq")}
              className={`pb-3 text-sm font-medium transition relative ${
                activeTab === "dlq" ? "text-teal-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Dead Letter Queue ({deadReminders.length})
              {activeTab === "dlq" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("failures")}
              className={`pb-3 text-sm font-medium transition relative ${
                activeTab === "failures" ? "text-teal-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Failed Deliveries ({failures.length})
              {activeTab === "failures" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("unverified")}
              className={`pb-3 text-sm font-medium transition relative ${
                activeTab === "unverified" ? "text-teal-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Unverified Rules ({unverifiedRules.length})
              {activeTab === "unverified" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />
              )}
            </button>
          </div>

          {/* DLQ Tab */}
          {activeTab === "dlq" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
              {deadReminders.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <div className="text-3xl">🎉</div>
                  <div className="font-medium text-slate-300">Dead Letter Queue is Empty</div>
                  <div className="text-xs">All compliance reminders have processed successfully without terminal failure.</div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold">
                      <th className="p-4">Business</th>
                      <th className="p-4">Period & Due Date</th>
                      <th className="p-4">Channel / Offset</th>
                      <th className="p-4">Attempts</th>
                      <th className="p-4">Failure Reason</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {deadReminders.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-4 font-medium text-slate-200">{r.businessName}</td>
                        <td className="p-4 text-slate-300">
                          {r.periodLabel} ({r.dueDate})
                        </td>
                        <td className="p-4 text-slate-400">
                          {r.channel} (-{r.offsetDays}d)
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 text-xs rounded bg-red-950 text-red-300 border border-red-800">
                            {r.attempts}/5 Dead
                          </span>
                        </td>
                        <td className="p-4 text-xs text-red-400 font-mono max-w-xs truncate">
                          {r.lastError || "Unknown error"}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleRetryReminder(r.id)}
                            disabled={actionLoading === r.id}
                            className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-medium transition"
                          >
                            {actionLoading === r.id ? "Retrying..." : "Retry"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Delivery Failures Tab */}
          {activeTab === "failures" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
              {failures.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <div className="text-3xl">✅</div>
                  <div className="font-medium text-slate-300">No Failed Deliveries</div>
                  <div className="text-xs">No failed delivery logs recorded in the system.</div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold">
                      <th className="p-4">Reminder ID</th>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Result</th>
                      <th className="p-4">Error Diagnostics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {failures.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-4 font-mono text-xs text-slate-300">{f.reminderId}</td>
                        <td className="p-4 text-slate-400 text-xs">
                          {new Date(f.attemptAt).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 text-xs rounded bg-red-950 text-red-300 border border-red-800">
                            Failure
                          </span>
                        </td>
                        <td className="p-4 text-xs text-red-400 font-mono">{f.error || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Unverified Rules Tab */}
          {activeTab === "unverified" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400">
                  ⚠️ Per AGENTS.md, unverified rules require human two-person verification before marking verified = true.
                </span>
                <span className="text-xs bg-amber-900/40 text-amber-300 px-2.5 py-0.5 rounded border border-amber-800">
                  {unverifiedRules.length} Pending Review
                </span>
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold">
                    <th className="p-4">Form Code</th>
                    <th className="p-4">Rule Name</th>
                    <th className="p-4">Frequency</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Official Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {unverifiedRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-4 font-mono text-xs text-teal-300">{rule.formCode}</td>
                      <td className="p-4 font-medium text-slate-200">{rule.name}</td>
                      <td className="p-4 text-xs text-slate-400 capitalize">{rule.frequency}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 text-xs rounded bg-amber-950 text-amber-300 border border-amber-800">
                          Pending Verification
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <a
                          href={rule.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                          Verify Source ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        Reminder tool, not tax advice. Verify dates with the official portal or your CA.
      </footer>
    </div>
  );
}
