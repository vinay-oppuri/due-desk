"use client";

import React, { useState } from "react";
import Link from "next/link";

interface SampleDeadline {
  formCode: string;
  name: string;
  category: "GST" | "TDS" | "Payroll" | "ROC";
  frequency: string;
  dueDate: string;
  appliesTo: string;
  source: string;
}

const UPCOMING_DEADLINES: SampleDeadline[] = [
  {
    formCode: "GSTR-1",
    name: "Outward Supplies Return (Monthly)",
    category: "GST",
    frequency: "Monthly",
    dueDate: "11th of every month",
    appliesTo: "Regular taxpayers with turnover > ₹5 Cr or not in QRMP",
    source: "https://www.gst.gov.in",
  },
  {
    formCode: "GSTR-3B",
    name: "Summary Return & Tax Payment",
    category: "GST",
    frequency: "Monthly",
    dueDate: "20th of every month",
    appliesTo: "All registered monthly GST filers",
    source: "https://www.gst.gov.in",
  },
  {
    formCode: "IFF",
    name: "Invoice Furnishing Facility (QRMP)",
    category: "GST",
    frequency: "Monthly (M1 & M2)",
    dueDate: "13th of next month",
    appliesTo: "Quarterly filers opting to pass ITC in first two months",
    source: "https://www.gst.gov.in",
  },
  {
    formCode: "CHALLAN-ITNS-281",
    name: "TDS / TCS Monthly Deposit",
    category: "TDS",
    frequency: "Monthly",
    dueDate: "7th of every month",
    appliesTo: "All corporate & non-corporate tax deductors",
    source: "https://www.incometax.gov.in",
  },
  {
    formCode: "FORM-24Q",
    name: "Quarterly TDS Return (Salary)",
    category: "TDS",
    frequency: "Quarterly",
    dueDate: "31st of month following quarter end",
    appliesTo: "Employers deducting tax on employee salaries",
    source: "https://www.incometax.gov.in",
  },
  {
    formCode: "EPF-ECR",
    name: "Provident Fund Monthly Electronic Challan",
    category: "Payroll",
    frequency: "Monthly",
    dueDate: "15th of every month",
    appliesTo: "Establishments with 20+ salaried employees",
    source: "https://www.epfindia.gov.in",
  },
  {
    formCode: "ESIC-CHALLAN",
    name: "Employee State Insurance Contribution",
    category: "Payroll",
    frequency: "Monthly",
    dueDate: "15th of every month",
    appliesTo: "Factories and establishments with 10+ employees earning <= ₹21,000",
    source: "https://www.esic.gov.in",
  },
  {
    formCode: "DIR-3-KYC",
    name: "Director KYC Verification",
    category: "ROC",
    frequency: "Annual",
    dueDate: "30th September annually",
    appliesTo: "All individuals holding an active Director Identification Number (DIN)",
    source: "https://www.mca.gov.in",
  },
  {
    formCode: "AOC-4",
    name: "Financial Statements Filing",
    category: "ROC",
    frequency: "Annual (AGM-relative)",
    dueDate: "30 days from Annual General Meeting (AGM)",
    appliesTo: "All registered Private & Public Limited Companies",
    source: "https://www.mca.gov.in",
  },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"ALL" | "GST" | "TDS" | "Payroll" | "ROC">("ALL");

  const filteredDeadlines =
    activeTab === "ALL"
      ? UPCOMING_DEADLINES
      : UPCOMING_DEADLINES.filter((d) => d.category === activeTab);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black flex flex-col font-sans">
      {/* Top Pre-login Navigation */}
      <header className="sticky top-0 z-50 border-b border-neutral-900 bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white text-black font-black text-sm flex items-center justify-center font-mono">
                D
              </div>
              <span className="font-mono text-sm tracking-widest uppercase font-bold text-white">
                DueDesk
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-xs font-mono uppercase tracking-wider text-neutral-400">
              <a href="#features" className="hover:text-white transition-colors">
                Platform
              </a>
              <a href="#deadlines" className="hover:text-white transition-colors">
                Deadlines
              </a>
              <Link href="/gst-due-dates" className="hover:text-white transition-colors">
                GST Calendar
              </Link>
              <Link href="/tds-due-dates" className="hover:text-white transition-colors">
                TDS Calendar
              </Link>
              <Link href="/roc-filing-deadlines" className="hover:text-white transition-colors">
                ROC Deadlines
              </Link>
              <a href="#pricing" className="hover:text-white transition-colors">
                Pricing
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth"
              className="text-xs font-mono uppercase tracking-wider px-3.5 py-2 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-600 transition-colors"
            >
              Sign In
            </Link>
            <a
              href={`${appUrl}/dashboard`}
              className="text-xs font-mono uppercase tracking-wider px-4 py-2 bg-white text-black font-semibold hover:bg-neutral-200 border border-white transition-colors hidden sm:inline-block"
            >
              Open Workspace &rarr;
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-32 border-b border-neutral-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-mono border border-neutral-800 bg-neutral-950 text-neutral-400 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Statutory Compliance Tracker for Indian Businesses & CA Firms
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
            Zero Missed Deadlines.
            <br />
            <span className="bg-gradient-to-r from-neutral-200 via-neutral-400 to-neutral-600 bg-clip-text text-transparent">
              Zero Penalties & Late Fees.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-neutral-400 leading-relaxed font-normal">
            Personalized, rule-governed statutory compliance calendar tailored to your company's
            structure, turnover, and state. Includes automated 7/3/1 day alerts, Cloudflare R2 proof
            vault, and multi-client CA team workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/auth"
              className="w-full sm:w-auto px-6 py-3.5 bg-white text-black font-mono text-xs uppercase tracking-wider font-semibold hover:bg-neutral-200 border border-white transition-colors text-center"
            >
              Get Started Free &rarr;
            </Link>
            <a
              href="#deadlines"
              className="w-full sm:w-auto px-6 py-3.5 bg-neutral-950 text-white font-mono text-xs uppercase tracking-wider font-medium hover:bg-neutral-900 border border-neutral-800 transition-colors text-center"
            >
              Explore Statutory Calendars
            </a>
          </div>

          {/* Core Trust Pillars Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 text-left">
            <div className="p-4 border border-neutral-900 bg-neutral-950/60">
              <div className="text-lg font-bold text-white font-mono">100% Rule Engine</div>
              <div className="text-xs text-neutral-400 mt-1">
                Deterministic tax rules with holiday shifts. Zero AI hallucinations.
              </div>
            </div>
            <div className="p-4 border border-neutral-900 bg-neutral-950/60">
              <div className="text-lg font-bold text-white font-mono">7 / 3 / 1 Day Alerts</div>
              <div className="text-xs text-neutral-400 mt-1">
                Postgres outbox pipeline with retry backoff and watchdog self-healing.
              </div>
            </div>
            <div className="p-4 border border-neutral-900 bg-neutral-950/60">
              <div className="text-lg font-bold text-white font-mono">Proof Document Vault</div>
              <div className="text-xs text-neutral-400 mt-1">
                Private Cloudflare R2 storage with 8-year statutory retention lock.
              </div>
            </div>
            <div className="p-4 border border-neutral-900 bg-neutral-950/60">
              <div className="text-lg font-bold text-white font-mono">CA Multi-Client</div>
              <div className="text-xs text-neutral-400 mt-1">
                Manage 100+ clients from one board with staff assignment & consolidated digest.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Statutory Deadlines Preview Section */}
      <section id="deadlines" className="py-20 border-b border-neutral-900 bg-neutral-950/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                Official Government Rules
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                Statutory Compliance Deadlines
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Pre-configured statutory tax rules with gazette citations and holiday roll-forwards.
              </p>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1 border border-neutral-800 p-1 bg-black">
              {(["ALL", "GST", "TDS", "Payroll", "ROC"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider cursor-pointer transition-colors ${
                    activeTab === tab
                      ? "bg-white text-black font-semibold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="border border-neutral-800 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Form Code</th>
                  <th className="py-3 px-4">Compliance Name</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Statutory Due Date</th>
                  <th className="py-3 px-4">Applicability</th>
                  <th className="py-3 px-4 text-right">Official Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 bg-black">
                {filteredDeadlines.map((item) => (
                  <tr key={item.formCode} className="hover:bg-neutral-950/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">{item.formCode}</td>
                    <td className="py-3.5 px-4 text-neutral-300">{item.name}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 border border-neutral-800 text-[10px] text-neutral-400">
                        {item.frequency}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-amber-400 font-medium">{item.dueDate}</td>
                    <td className="py-3.5 px-4 text-neutral-400 max-w-xs truncate">
                      {item.appliesTo}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={item.source}
                        target="_blank"
                        rel="noreferrer"
                        className="text-neutral-400 hover:text-white underline underline-offset-2"
                      >
                        Official Portal &rarr;
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Deep link cards to dedicated SEO pages */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Link
              href="/gst-due-dates"
              className="p-4 border border-neutral-800 bg-black hover:border-neutral-600 transition-colors group"
            >
              <div className="text-xs font-mono text-neutral-500 uppercase">Dedicated Guide</div>
              <div className="text-sm font-semibold text-white mt-1 group-hover:text-amber-400 transition-colors">
                GST Due Dates & Filing Calendar &rarr;
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Full breakdown of GSTR-1, GSTR-3B, QRMP schemes and late fee calculation rules.
              </p>
            </Link>

            <Link
              href="/tds-due-dates"
              className="p-4 border border-neutral-800 bg-black hover:border-neutral-600 transition-colors group"
            >
              <div className="text-xs font-mono text-neutral-500 uppercase">Dedicated Guide</div>
              <div className="text-sm font-semibold text-white mt-1 group-hover:text-amber-400 transition-colors">
                TDS / TCS Due Dates & Return Calendar &rarr;
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Monthly Challan 281 deposit deadlines and quarterly 24Q, 26Q return filing schedules.
              </p>
            </Link>

            <Link
              href="/roc-filing-deadlines"
              className="p-4 border border-neutral-800 bg-black hover:border-neutral-600 transition-colors group"
            >
              <div className="text-xs font-mono text-neutral-500 uppercase">Dedicated Guide</div>
              <div className="text-sm font-semibold text-white mt-1 group-hover:text-amber-400 transition-colors">
                MCA & ROC Corporate Filing Deadlines &rarr;
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                AOC-4 financial statements, MGT-7 annual returns, and annual DIR-3 KYC compliance.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Platform Features Section */}
      <section id="features" className="py-20 border-b border-neutral-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              Built for Precision
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Engineered for Zero Non-Compliance
            </h2>
            <p className="text-sm text-neutral-400">
              Generic calendar apps fail because statutory tax rules are complex. DueDesk is purpose-built
              for Indian legal requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-4">
              <div className="w-10 h-10 border border-neutral-700 bg-neutral-900 flex items-center justify-center font-mono font-bold text-white text-sm">
                01
              </div>
              <h3 className="text-lg font-semibold text-white">State-Aware Holiday Shifting</h3>
              <p className="text-xs font-mono text-neutral-400 leading-relaxed">
                When a statutory due date falls on a Sunday or official state gazetted holiday, our rules engine automatically computes the next working day according to Section 10 of the General Clauses Act.
              </p>
            </div>

            <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-4">
              <div className="w-10 h-10 border border-neutral-700 bg-neutral-900 flex items-center justify-center font-mono font-bold text-white text-sm">
                02
              </div>
              <h3 className="text-lg font-semibold text-white">Postgres Outbox & Reliable Dispatch</h3>
              <p className="text-xs font-mono text-neutral-400 leading-relaxed">
                Reminders are stored in atomic database rows with row-level concurrency locks (<code className="text-neutral-300">FOR UPDATE SKIP LOCKED</code>). Automated retries with exponential backoff and a daily self-healing watchdog.
              </p>
            </div>

            <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-4">
              <div className="w-10 h-10 border border-neutral-700 bg-neutral-900 flex items-center justify-center font-mono font-bold text-white text-sm">
                03
              </div>
              <h3 className="text-lg font-semibold text-white">Statutory Audit-Proof Document Vault</h3>
              <p className="text-xs font-mono text-neutral-400 leading-relaxed">
                Store official filing acknowledgments and challan receipts in private Cloudflare R2 object storage. Locked with an 8-year statutory retention hold to satisfy Section 128 of the Companies Act.
              </p>
            </div>

            <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-4">
              <div className="w-10 h-10 border border-neutral-700 bg-neutral-900 flex items-center justify-center font-mono font-bold text-white text-sm">
                04
              </div>
              <h3 className="text-lg font-semibold text-white">CA Multi-Client Command Center</h3>
              <p className="text-xs font-mono text-neutral-400 leading-relaxed">
                Chartered Accountants manage dozens of client entities from a single unified view. Bulk onboard clients via CSV, assign returns to staff members, and receive one consolidated weekly executive digest.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 border-b border-neutral-900 bg-neutral-950/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              Clear & Transparent
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Plans Built for Businesses of Any Scale
            </h2>
            <p className="text-sm text-neutral-400">
              Start with our 100% free plan. Upgrade only when your company or firm grows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="p-6 border border-neutral-800 bg-black flex flex-col justify-between">
              <div className="space-y-4">
                <div className="text-xs font-mono uppercase tracking-wider text-neutral-500">Starter</div>
                <div className="text-3xl font-bold text-white font-mono">₹0</div>
                <div className="text-xs text-neutral-400">Forever free for small business owners and single entities.</div>
                <ul className="space-y-2 pt-4 border-t border-neutral-900 text-xs font-mono text-neutral-300">
                  <li>✓ 1 Business Entity</li>
                  <li>✓ Full Statutory Compliance Calendar</li>
                  <li>✓ 7, 3 & 1 Day Email Reminders</li>
                  <li>✓ RFC 5545 .ics Calendar Sync Feed</li>
                  <li>✗ Document Proof Vault</li>
                </ul>
              </div>
              <Link
                href="/auth"
                className="mt-8 block w-full py-3 text-center border border-neutral-700 hover:border-white text-xs font-mono uppercase tracking-wider font-semibold text-white transition-colors"
              >
                Start Free
              </Link>
            </div>

            {/* Standard */}
            <div className="p-6 border-2 border-white bg-neutral-950 flex flex-col justify-between relative shadow-2xl">
              <div className="absolute -top-3 right-4 px-2 py-0.5 bg-white text-black text-[10px] font-mono uppercase tracking-widest font-bold">
                Most Popular
              </div>
              <div className="space-y-4">
                <div className="text-xs font-mono uppercase tracking-wider text-neutral-400">Standard</div>
                <div className="text-3xl font-bold text-white font-mono">₹499 <span className="text-xs font-normal text-neutral-500">/ mo</span></div>
                <div className="text-xs text-neutral-400">For growing businesses and startups with multiple entities.</div>
                <ul className="space-y-2 pt-4 border-t border-neutral-900 text-xs font-mono text-neutral-300">
                  <li>✓ Up to 5 Business Entities</li>
                  <li>✓ 100MB Private Document Vault</li>
                  <li>✓ 8-Year Statutory Retention Lock</li>
                  <li>✓ Up to 5 Team Members with RBAC</li>
                  <li>✓ Priority Email Delivery</li>
                </ul>
              </div>
              <Link
                href="/auth"
                className="mt-8 block w-full py-3 text-center bg-white text-black text-xs font-mono uppercase tracking-wider font-semibold hover:bg-neutral-200 transition-colors"
              >
                Choose Standard
              </Link>
            </div>

            {/* Pro */}
            <div className="p-6 border border-neutral-800 bg-black flex flex-col justify-between">
              <div className="space-y-4">
                <div className="text-xs font-mono uppercase tracking-wider text-neutral-500">Pro & CA Firm</div>
                <div className="text-3xl font-bold text-white font-mono">₹1,499 <span className="text-xs font-normal text-neutral-500">/ mo</span></div>
                <div className="text-xs text-neutral-400">For Chartered Accountants, tax practitioners, and enterprises.</div>
                <ul className="space-y-2 pt-4 border-t border-neutral-900 text-xs font-mono text-neutral-300">
                  <li>✓ Unlimited Client Businesses</li>
                  <li>✓ CA Multi-Client Master Board</li>
                  <li>✓ Bulk Client CSV Import with Dry-Run</li>
                  <li>✓ Staff Obligation Assignment</li>
                  <li>✓ Consolidated Weekly Digest Email</li>
                  <li>✓ 1GB Cloud Storage Vault</li>
                </ul>
              </div>
              <Link
                href="/auth"
                className="mt-8 block w-full py-3 text-center border border-neutral-700 hover:border-white text-xs font-mono uppercase tracking-wider font-semibold text-white transition-colors"
              >
                Choose Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Statutory Disclaimer Banner */}
      <section className="py-8 bg-neutral-950 border-b border-neutral-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs font-mono text-neutral-400 leading-relaxed">
            <span className="font-bold text-neutral-200">STATUTORY NOTICE:</span> DueDesk is an informational reminder and deadline tracking tool. It does not provide legal, taxation, or audit advice. Users must verify all statutory due dates and tax returns with the official government portals (GSTN, Income Tax e-Filing, MCA21) or consult a qualified Chartered Accountant.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-black border-t border-neutral-900 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="font-bold text-white tracking-wider uppercase">DueDesk</div>
            <p className="text-neutral-500 leading-relaxed">
              India's trusted statutory compliance calendar for GST, TDS, PF/ESI, and ROC.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-neutral-300 uppercase">Statutory Guides</div>
            <ul className="space-y-1.5 text-neutral-500">
              <li><Link href="/gst-due-dates" className="hover:text-white transition-colors">GST Due Dates</Link></li>
              <li><Link href="/tds-due-dates" className="hover:text-white transition-colors">TDS & TCS Deadlines</Link></li>
              <li><Link href="/roc-filing-deadlines" className="hover:text-white transition-colors">ROC & MCA Deadlines</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-neutral-300 uppercase">Product & Workspace</div>
            <ul className="space-y-1.5 text-neutral-500">
              <li><Link href="/auth" className="hover:text-white transition-colors">Sign In</Link></li>
              <li><a href={`${appUrl}/dashboard`} className="hover:text-white transition-colors">Workspace Dashboard</a></li>
              <li><a href={`${appUrl}/ca-workspace`} className="hover:text-white transition-colors">CA Firm Portal</a></li>
              <li><a href={`${appUrl}/billing`} className="hover:text-white transition-colors">Pricing & Plans</a></li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-neutral-300 uppercase">Legal & Compliance</div>
            <ul className="space-y-1.5 text-neutral-500">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy (DPDP)</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/refund" className="hover:text-white transition-colors">Refund Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 mt-8 border-t border-neutral-900 text-center text-neutral-600">
          &copy; {new Date().getFullYear()} DueDesk Technologies. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
