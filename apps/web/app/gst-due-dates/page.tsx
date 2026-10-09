import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GST Due Dates Calendar 2026-27 | GSTR-1, GSTR-3B, QRMP Deadlines",
  description:
    "Complete statutory GST return due dates calendar for India. Deadlines for GSTR-1, GSTR-3B, QRMP IFF, and annual returns with shift-on-holiday rules and late fee details.",
};

const GST_RULES = [
  {
    code: "GSTR-1 (Monthly)",
    name: "Details of Outward Supplies",
    due: "11th of succeeding month",
    applicableTo: "Taxpayers with aggregate turnover > ₹5 Crore or not opted for QRMP",
    lateFee: "₹50 per day (₹20 for Nil returns), subject to turnover caps",
  },
  {
    code: "IFF (QRMP)",
    name: "Invoice Furnishing Facility",
    due: "13th of succeeding month (M1 & M2 of quarter)",
    applicableTo: "Quarterly filers opting to upload B2B invoices for ITC claim",
    lateFee: "Optional facility; invoices can be uploaded in subsequent return",
  },
  {
    code: "GSTR-3B (Monthly)",
    name: "Summary Return & Tax Settlement",
    due: "20th of succeeding month",
    applicableTo: "All monthly registered taxpayers",
    lateFee: "₹50 per day (₹20 for Nil returns) plus 18% p.a. interest on net cash tax",
  },
  {
    code: "GSTR-3B (QRMP Category 1)",
    name: "Quarterly Return (State Group 1)",
    due: "22nd of month following quarter end",
    applicableTo: "Southern & Western States (KA, MH, TS, TN, AP, GJ, KL, Goa, etc.)",
    lateFee: "₹50 per day (₹20 for Nil returns) plus 18% p.a. interest",
  },
  {
    code: "GSTR-3B (QRMP Category 2)",
    name: "Quarterly Return (State Group 2)",
    due: "24th of month following quarter end",
    applicableTo: "Northern & Eastern States (DL, UP, HR, PB, RJ, WB, etc.)",
    lateFee: "₹50 per day (₹20 for Nil returns) plus 18% p.a. interest",
  },
  {
    code: "CMP-08",
    name: "Composition Scheme Quarterly Statement",
    due: "18th of month following quarter end",
    applicableTo: "Dealers registered under Section 10 Composition Levy",
    lateFee: "Late fee under section 47 plus interest under section 50",
  },
  {
    code: "GSTR-9 & 9C",
    name: "Annual Return & Reconciliation",
    due: "31st December following financial year end",
    applicableTo: "Regular taxpayers with turnover > ₹2 Cr (GSTR-9) and > ₹5 Cr (9C)",
    lateFee: "₹50 per day up to 0.04% of turnover",
  },
];

export default function GstDueDatesPage() {
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
            Statutory Reference Guide &bull; Updated for FY 2026-27
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            GST Filing Due Dates & Compliance Calendar
          </h1>
          <p className="text-sm text-neutral-400 max-w-3xl leading-relaxed">
            Statutory deadlines for Indian Goods and Services Tax filings. Under Section 10 of the General
            Clauses Act, if a statutory due date falls on a Sunday or official public holiday, the due date shifts to the next working day.
          </p>
        </div>

        {/* Rules Table */}
        <div className="border border-neutral-800 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 uppercase tracking-wider">
                <th className="py-3 px-4">Form Code</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Statutory Due Date</th>
                <th className="py-3 px-4">Assessee Category</th>
                <th className="py-3 px-4">Late Fee / Interest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 bg-black">
              {GST_RULES.map((rule) => (
                <tr key={rule.code} className="hover:bg-neutral-950 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                    {rule.code}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-300">{rule.name}</td>
                  <td className="py-3.5 px-4 text-amber-400 font-semibold whitespace-nowrap">
                    {rule.due}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-400">{rule.applicableTo}</td>
                  <td className="py-3.5 px-4 text-neutral-400">{rule.lateFee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA Box */}
        <div className="p-8 border border-neutral-800 bg-neutral-950 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Track Your Exact GST Dates Automatically</h2>
            <p className="text-xs text-neutral-400 max-w-xl">
              Don't manually calculate QRMP state groups or holiday shifts. DueDesk automatically provisions a personalized calendar for your GSTIN with 7, 3, and 1-day alerts.
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
          Disclaimer: This guide is for informational purposes only and does not constitute tax advice. Statutory dates are subject to CBIC notifications. Always verify with <a href="https://www.gst.gov.in" target="_blank" rel="noreferrer" className="text-neutral-400 underline">gst.gov.in</a> or your Chartered Accountant.
        </div>
      </main>

      <footer className="border-t border-neutral-900 py-6 text-center text-xs font-mono text-neutral-600">
        &copy; {new Date().getFullYear()} DueDesk Technologies. All rights reserved.
      </footer>
    </div>
  );
}
