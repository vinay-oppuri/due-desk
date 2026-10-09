import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ROC Filing Deadlines & MCA Compliance Calendar 2026-27 | DueDesk",
  description:
    "Statutory calendar for Ministry of Corporate Affairs (MCA) ROC filings in India. Deadlines for Form AOC-4, MGT-7, DIR-3 KYC, ADT-1, and MSME-1 with Section 403 late fee details.",
};

const ROC_RULES = [
  {
    code: "Form DIR-3 KYC",
    name: "Annual Director KYC Verification",
    due: "30th September annually",
    applicableTo: "All individuals holding an active Director Identification Number (DIN)",
    latePenalty: "₹5,000 one-time penalty; deactivation of DIN if not filed by due date",
  },
  {
    code: "Form DPT-3",
    name: "Return of Deposits & Non-Deposit Loans",
    due: "30th June annually",
    applicableTo: "All companies except government companies",
    latePenalty: "₹100 per day late fee; fine up to ₹5,000 plus ₹500/day on continued default",
  },
  {
    code: "Form AOC-4 / AOC-4 XBRL",
    name: "Filing of Financial Statements & Audit Report",
    due: "30 days from date of AGM (typically Oct 29 if AGM held Sept 30)",
    applicableTo: "All registered Private & Public Limited Companies",
    latePenalty: "₹100 per day of delay per form with NO upper cap under Section 403",
  },
  {
    code: "Form MGT-7 / MGT-7A",
    name: "Annual Return Filing",
    due: "60 days from date of AGM (typically Nov 29 if AGM held Sept 30)",
    applicableTo: "All companies (MGT-7A for Small Companies and OPCs)",
    latePenalty: "₹100 per day of delay per form with NO upper cap under Section 403",
  },
  {
    code: "Form ADT-1",
    name: "Intimation of Statutory Auditor Appointment",
    due: "15 days from date of AGM",
    applicableTo: "All companies appointing statutory auditors under Section 139",
    latePenalty: "Graduated late filing fees up to 12 times the normal filing fee",
  },
  {
    code: "Form MSME-1 (H1 & H2)",
    name: "Half-Yearly Return of Outstanding MSME Dues",
    due: "31st October (for Apr - Sep) & 30th April (for Oct - Mar)",
    applicableTo: "Companies with outstanding payments to MSME suppliers > 45 days",
    latePenalty: "Fine up to ₹20,000 for company and every officer in default",
  },
];

export default function RocDeadlinesPage() {
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
            Ministry of Corporate Affairs (MCA21) &bull; Companies Act, 2013
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            ROC Annual Compliance Deadlines & Filing Calendar
          </h1>
          <p className="text-sm text-neutral-400 max-w-3xl leading-relaxed">
            Statutory timelines for Registrar of Companies (ROC) filings under the Companies Act, 2013. Late filing of annual statutory forms like AOC-4 and MGT-7 incurs a severe statutory penalty of ₹100 per day per form with no statutory ceiling.
          </p>
        </div>

        {/* Table */}
        <div className="border border-neutral-800 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 uppercase tracking-wider">
                <th className="py-3 px-4">Form Code</th>
                <th className="py-3 px-4">Statutory Form Name</th>
                <th className="py-3 px-4">Due Date Calculation</th>
                <th className="py-3 px-4">Applicability</th>
                <th className="py-3 px-4">Late Penalty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 bg-black">
              {ROC_RULES.map((rule) => (
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
            <h2 className="text-lg font-bold text-white">Track AGM-Relative ROC Deadlines Automatically</h2>
            <p className="text-xs text-neutral-400 max-w-xl">
              DueDesk dynamically computes your AOC-4 (30 days) and MGT-7 (60 days) deadlines based on your specific AGM date and alerts you before daily late fees accumulate.
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
          Disclaimer: This guide is for reference only. Filing requirements are governed by the Companies Act, 2013 and MCA rules. Always verify with <a href="https://www.mca.gov.in" target="_blank" rel="noreferrer" className="text-neutral-400 underline">mca.gov.in</a> or your Company Secretary / Chartered Accountant.
        </div>
      </main>

      <footer className="border-t border-neutral-900 py-6 text-center text-xs font-mono text-neutral-600">
        &copy; {new Date().getFullYear()} DueDesk Technologies. All rights reserved.
      </footer>
    </div>
  );
}
