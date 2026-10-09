import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TDS Due Dates Calendar 2026-27 | Challan 281, 24Q, 26Q Deadlines",
  description:
    "Statutory calendar for Indian Tax Deducted at Source (TDS) and TCS deadlines. Challan 281 monthly deposit due dates, quarterly Form 24Q & 26Q return deadlines, and Section 234E late fees.",
};

const TDS_RULES = [
  {
    code: "Challan ITNS-281 (Monthly)",
    name: "TDS / TCS Monthly Deposit",
    due: "7th of succeeding month (April 30 for March)",
    applicableTo: "All entities deducting tax under Chapter XVII-B",
    latePenalty: "Interest @ 1.5% per month or part of a month under Section 201(1A)",
  },
  {
    code: "Form 24Q (Q1: Apr - Jun)",
    name: "Quarterly TDS Return - Salary",
    due: "31st July",
    applicableTo: "All employers deducting tax under Section 192",
    latePenalty: "₹200 per day under Section 234E up to total TDS amount",
  },
  {
    code: "Form 24Q (Q2: Jul - Sep)",
    name: "Quarterly TDS Return - Salary",
    due: "31st October",
    applicableTo: "All employers deducting tax under Section 192",
    latePenalty: "₹200 per day under Section 234E up to total TDS amount",
  },
  {
    code: "Form 24Q (Q3: Oct - Dec)",
    name: "Quarterly TDS Return - Salary",
    due: "31st January",
    applicableTo: "All employers deducting tax under Section 192",
    latePenalty: "₹200 per day under Section 234E up to total TDS amount",
  },
  {
    code: "Form 24Q (Q4: Jan - Mar)",
    name: "Quarterly TDS Return - Salary",
    due: "31st May",
    applicableTo: "All employers deducting tax under Section 192",
    latePenalty: "₹200 per day under Section 234E up to total TDS amount",
  },
  {
    code: "Form 26Q (Q1 - Q4)",
    name: "TDS on Payments Other than Salary",
    due: "31st of month following quarter end (May 31 for Q4)",
    applicableTo: "Payments for contract (194C), professional fees (194J), rent (194I), etc.",
    latePenalty: "₹200 per day under Section 234E plus penalty under 271H (₹10,000 to ₹1,00,000)",
  },
  {
    code: "Form 16",
    name: "Annual TDS Certificate (Salary)",
    due: "15th June annually",
    applicableTo: "Issued to employees for whom tax was deducted under Section 192",
    latePenalty: "₹100 per day under Section 272A(2)(g) for failure to furnish",
  },
];

export default function TdsDueDatesPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black flex flex-col font-sans">
      <header className="border-b border-neutral-900 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white text-black font-black text-sm flex items-center justify-center font-mono">
              D
            </div>
            <span className="font-mono text-sm tracking-widest uppercase font-bold text-white">
              DueDesk
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/auth"
              className="text-xs font-mono uppercase tracking-wider px-3.5 py-1.5 text-neutral-300 hover:text-white border border-neutral-800"
            >
              Sign In
            </Link>
            <a
              href={`${appUrl}/dashboard`}
              className="text-xs font-mono uppercase tracking-wider px-3.5 py-1.5 bg-white text-black font-semibold hover:bg-neutral-200"
            >
              Open App &rarr;
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 flex-1 space-y-12">
        <div className="space-y-4">
          <div className="text-xs font-mono uppercase tracking-widest text-neutral-500">
            Statutory Income Tax Calendar &bull; FY 2026-27
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            TDS / TCS Filing Deadlines & Compliance Guide
          </h1>
          <p className="text-sm text-neutral-400 max-w-3xl leading-relaxed">
            Statutory timelines for Indian Tax Deducted at Source under the Income-tax Act, 1961. Failure to deposit tax by the due date incurs mandatory 1.5% monthly interest, and late return filing attracts ₹200 per day late fee under Section 234E.
          </p>
        </div>

        {/* Table */}
        <div className="border border-neutral-800 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 uppercase tracking-wider">
                <th className="py-3 px-4">Form Code</th>
                <th className="py-3 px-4">Compliance Type</th>
                <th className="py-3 px-4">Statutory Due Date</th>
                <th className="py-3 px-4">Applicability</th>
                <th className="py-3 px-4">Late Penalty / Interest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 bg-black">
              {TDS_RULES.map((rule) => (
                <tr key={rule.code} className="hover:bg-neutral-950 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                    {rule.code}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-300">{rule.name}</td>
                  <td className="py-3.5 px-4 text-amber-400 font-semibold whitespace-nowrap">
                    {rule.due}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-400">{rule.applicableTo}</td>
                  <td className="py-3.5 px-4 text-neutral-400">{rule.latePenalty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA */}
        <div className="p-8 border border-neutral-800 bg-neutral-950 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Automate Your TDS Payment & Return Reminders</h2>
            <p className="text-xs text-neutral-400 max-w-xl">
              DueDesk automatically monitors your monthly 7th deposit dates and quarterly return deadlines with outbox reminders and receipt storage.
            </p>
          </div>
          <Link
            href="/auth"
            className="px-6 py-3 bg-white text-black text-xs font-mono uppercase tracking-wider font-semibold hover:bg-neutral-200 whitespace-nowrap"
          >
            Start Free Workspace &rarr;
          </Link>
        </div>

        {/* Disclaimer */}
        <div className="p-4 border border-neutral-900 bg-black text-[11px] font-mono text-neutral-500">
          Disclaimer: This guide is for reference only. Due dates and penalty provisions are governed by the Income-tax Act, 1961. Always confirm with the <a href="https://www.incometax.gov.in" target="_blank" rel="noreferrer" className="text-neutral-400 underline">Income Tax Portal</a> or consult your tax advisor.
        </div>
      </main>

      <footer className="border-t border-neutral-900 py-6 text-center text-xs font-mono text-neutral-600">
        &copy; {new Date().getFullYear()} DueDesk Technologies. All rights reserved.
      </footer>
    </div>
  );
}
