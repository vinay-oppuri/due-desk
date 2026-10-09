"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { authClient } from "../../lib/auth-client";

interface SubscriptionInfo {
  subscription: {
    id: string;
    organizationId: string;
    plan: "free" | "standard" | "pro";
    status: "active" | "past_due" | "canceled" | "grace_period";
    currentPeriodEnd?: string;
  };
  planConfig: {
    tier: string;
    name: string;
    maxBusinesses: number;
    documentVaultEnabled: boolean;
    maxDocumentVaultBytes: number;
    maxTeamMembers: number;
    priceMonthlyInr: number;
    priceAnnualInr: number;
  };
  usage: {
    businessesCount: number;
    storageBytes: number;
    teamMembersCount: number;
  };
  permissions: {
    canAddBusiness: boolean;
    canUseDocumentVault: boolean;
    canAddTeamMember: boolean;
    isUsable: boolean;
  };
}

interface InvoiceItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  razorpayInvoiceId?: string;
  pdfUrl?: string;
  createdAt: string;
}

export default function BillingPage() {
  const { data: session } = authClient.useSession();

  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchBillingData = async () => {
    try {
      const [sRes, iRes] = await Promise.all([
        fetch("/api/v1/billing/subscription", { credentials: "include" }),
        fetch("/api/v1/billing/invoices", { credentials: "include" }),
      ]);

      if (sRes.ok) {
        const sData = await sRes.json();
        setSubInfo(sData);
      }
      if (iRes.ok) {
        const iData = await iRes.json();
        setInvoices(iData);
      }
    } catch (err: any) {
      console.error("Failed to load billing data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleUpgrade = async (plan: "standard" | "pro") => {
    setUpgrading(plan);
    try {
      // 1. In development / testing, use simulated upgrade helper for zero-spend verification
      const res = await fetch("/api/v1/billing/test-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });

      if (res.ok) {
        setMessage(`Successfully upgraded to the ${plan.toUpperCase()} plan!`);
        await fetchBillingData();
      } else {
        setMessage("Failed to upgrade plan. Please try again.");
      }
    } catch (err: any) {
      setMessage(`Error upgrading plan: ${err.message}`);
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-neutral-900 bg-neutral-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-xl font-bold tracking-tight text-white">
              DueDesk
            </Link>
            <span className="text-xs font-mono bg-neutral-900 text-neutral-400 px-2.5 py-0.5 rounded border border-neutral-800">
              Subscription & Plans
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-xs font-mono uppercase text-neutral-400 hover:text-white transition"
            >
              ← Back to Calendar
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-10 flex-1 w-full space-y-10">
        {message && (
          <div className="p-4 rounded border border-emerald-800 bg-emerald-950/40 text-emerald-300 text-xs font-mono flex justify-between items-center">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Current Plan & Status Banner */}
        {subInfo && (
          <div className="border border-neutral-800 bg-neutral-950 p-6 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-xs font-mono uppercase text-neutral-500">Active Subscription</div>
              <div className="text-2xl font-bold mt-1 flex items-center gap-3">
                <span>{subInfo.planConfig.name}</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded font-mono uppercase ${
                    subInfo.subscription.status === "active"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : subInfo.subscription.status === "grace_period"
                        ? "bg-amber-950 text-amber-400 border border-amber-800"
                        : "bg-red-950 text-red-400 border border-red-800"
                  }`}
                >
                  {subInfo.subscription.status === "grace_period"
                    ? "Grace Period (7 Days)"
                    : subInfo.subscription.status}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono mt-1">
                Usage: {subInfo.usage.businessesCount} of{" "}
                {subInfo.planConfig.maxBusinesses === Infinity ? "Unlimited" : subInfo.planConfig.maxBusinesses} businesses used • Document Vault:{" "}
                {subInfo.planConfig.documentVaultEnabled ? "Unlocked (100MB)" : "Locked (Standard/Pro)"}
              </p>
            </div>

            {subInfo.subscription.plan !== "pro" && (
              <a
                href="#pricing-tiers"
                className="px-4 py-2 bg-white text-black text-xs font-mono uppercase font-semibold hover:bg-neutral-200 transition"
              >
                Upgrade Plan
              </a>
            )}
          </div>
        )}

        {/* Billing Interval Toggle */}
        <div className="text-center space-y-3" id="pricing-tiers">
          <h2 className="text-2xl font-bold tracking-tight">Choose the Plan That Fits Your Scale</h2>
          <p className="text-xs font-mono text-neutral-400">
            Never miss a statutory deadline. Transparent pricing, zero hidden charges.
          </p>

          <div className="inline-flex items-center p-1 border border-neutral-800 bg-neutral-950 rounded-lg">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-4 py-1.5 text-xs font-mono uppercase rounded transition ${
                interval === "monthly" ? "bg-white text-black font-semibold" : "text-neutral-400 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`px-4 py-1.5 text-xs font-mono uppercase rounded transition flex items-center gap-1.5 ${
                interval === "annual" ? "bg-white text-black font-semibold" : "text-neutral-400 hover:text-white"
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-800">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free Tier */}
          <div className="border border-neutral-800 bg-neutral-950 p-6 rounded-lg flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Free Starter</h3>
                <p className="text-xs text-neutral-400 font-mono">For solo freelancers & single businesses</p>
              </div>
              <div className="text-3xl font-bold font-mono">
                ₹0 <span className="text-xs text-neutral-500 font-normal">/ forever</span>
              </div>
              <ul className="text-xs font-mono space-y-2 text-neutral-300">
                <li className="flex items-center gap-2">✓ 1 Business Entity</li>
                <li className="flex items-center gap-2">✓ Automated GST & TDS Deadlines</li>
                <li className="flex items-center gap-2">✓ Email Reminders (7, 3, 1 Days)</li>
                <li className="flex items-center gap-2">✓ Private .ICS Calendar Sync</li>
                <li className="flex items-center gap-2 text-neutral-600">✕ Document Vault Storage</li>
                <li className="flex items-center gap-2 text-neutral-600">✕ Team Collaborators</li>
              </ul>
            </div>

            <button
              disabled
              className="w-full py-2.5 border border-neutral-800 text-neutral-500 text-xs font-mono uppercase cursor-default"
            >
              {subInfo?.subscription.plan === "free" ? "Current Plan" : "Basic Tier"}
            </button>
          </div>

          {/* Standard Tier */}
          <div className="border-2 border-teal-500 bg-neutral-950 p-6 rounded-lg flex flex-col justify-between space-y-6 relative">
            <div className="absolute -top-3 right-4 px-2 py-0.5 bg-teal-500 text-black text-[10px] font-mono uppercase font-bold rounded">
              Most Popular
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-white">Standard Business</h3>
                <p className="text-xs text-neutral-400 font-mono">For growing businesses & small firms</p>
              </div>
              <div className="text-3xl font-bold font-mono">
                {interval === "monthly" ? "₹499" : "₹4,999"}{" "}
                <span className="text-xs text-neutral-500 font-normal">
                  / {interval === "monthly" ? "month" : "year"}
                </span>
              </div>
              <ul className="text-xs font-mono space-y-2 text-neutral-200">
                <li className="flex items-center gap-2">✓ Up to 5 Business Entities</li>
                <li className="flex items-center gap-2">✓ Private Cloud Document Vault (100MB)</li>
                <li className="flex items-center gap-2">✓ Filing Proofs & Challan Uploads</li>
                <li className="flex items-center gap-2">✓ Up to 3 Team Members</li>
                <li className="flex items-center gap-2">✓ 7-Day Grace Period Protection</li>
                <li className="flex items-center gap-2">✓ Priority Email Reminders</li>
              </ul>
            </div>

            {subInfo?.subscription.plan === "standard" ? (
              <button
                disabled
                className="w-full py-2.5 bg-neutral-900 border border-neutral-700 text-emerald-400 text-xs font-mono uppercase cursor-default font-medium"
              >
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade("standard")}
                disabled={upgrading === "standard"}
                className="w-full py-2.5 bg-white text-black text-xs font-mono uppercase font-semibold hover:bg-neutral-200 transition"
              >
                {upgrading === "standard" ? "Activating..." : "Upgrade to Standard"}
              </button>
            )}
          </div>

          {/* Pro Tier */}
          <div className="border border-neutral-800 bg-neutral-950 p-6 rounded-lg flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Pro & CA Multi-Client</h3>
                <p className="text-xs text-neutral-400 font-mono">For Chartered Accountants & enterprises</p>
              </div>
              <div className="text-3xl font-bold font-mono">
                {interval === "monthly" ? "₹1,499" : "₹14,999"}{" "}
                <span className="text-xs text-neutral-500 font-normal">
                  / {interval === "monthly" ? "month" : "year"}
                </span>
              </div>
              <ul className="text-xs font-mono space-y-2 text-neutral-300">
                <li className="flex items-center gap-2">✓ Unlimited Business Entities</li>
                <li className="flex items-center gap-2">✓ 1 GB Document Vault Storage</li>
                <li className="flex items-center gap-2">✓ Multi-Client Compliance Board</li>
                <li className="flex items-center gap-2">✓ Unlimited Team Collaborators</li>
                <li className="flex items-center gap-2">✓ WhatsApp & SMS Alerts (Phase 8+)</li>
                <li className="flex items-center gap-2">✓ Dedicated CA Audit Trail</li>
              </ul>
            </div>

            {subInfo?.subscription.plan === "pro" ? (
              <button
                disabled
                className="w-full py-2.5 bg-neutral-900 border border-neutral-700 text-emerald-400 text-xs font-mono uppercase cursor-default font-medium"
              >
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade("pro")}
                disabled={upgrading === "pro"}
                className="w-full py-2.5 border border-neutral-700 bg-neutral-900 text-white text-xs font-mono uppercase font-semibold hover:bg-neutral-800 transition"
              >
                {upgrading === "pro" ? "Activating..." : "Upgrade to Pro"}
              </button>
            )}
          </div>
        </div>

        {/* Invoices History */}
        <section className="space-y-4 pt-6 border-t border-neutral-900">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Tax Invoices & Payment Receipts</h3>
            <span className="text-xs font-mono text-neutral-500">GST-compliant statutory receipts</span>
          </div>

          <div className="border border-neutral-800 bg-neutral-950 rounded-lg overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-neutral-500">
                No billing transactions or invoices recorded yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-neutral-800 bg-black text-neutral-500 uppercase">
                    <th className="p-3">Date</th>
                    <th className="p-3">Invoice Ref</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-900/40 transition">
                      <td className="p-3 text-neutral-300">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 font-mono text-neutral-400">
                        {inv.razorpayInvoiceId || inv.id}
                      </td>
                      <td className="p-3 text-white font-semibold">
                        ₹{(inv.amount / 100).toFixed(2)} {inv.currency}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase text-[10px]">
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {inv.pdfUrl ? (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-400 underline hover:text-teal-300"
                          >
                            PDF Receipt ↗
                          </a>
                        ) : (
                          <span className="text-neutral-600">Online Paid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-600 font-mono">
        All plans processed securely via Razorpay. Reminder tool, not tax advice.
      </footer>
    </div>
  );
}
