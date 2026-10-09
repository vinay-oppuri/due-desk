import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | DueDesk Compliance Tracker",
  description:
    "Privacy Policy for DueDesk. Compliant with the Digital Personal Data Protection Act (DPDP Act, 2023) of India.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black flex flex-col font-sans">
      <header className="border-b border-neutral-900 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white text-black font-black text-sm flex items-center justify-center font-mono">
              D
            </div>
            <span className="font-mono text-sm tracking-widest uppercase font-bold text-white">
              DueDesk
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-white"
          >
            &larr; Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 flex-1 space-y-8 font-mono text-xs leading-relaxed text-neutral-300">
        <div className="space-y-2 border-b border-neutral-800 pb-6">
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">
            Privacy Policy
          </h1>
          <p className="text-neutral-500">
            Last Updated: October 2026 &bull; Compliant with Digital Personal Data Protection Act, 2023 (DPDP Act, India)
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            1. Purpose and Scope
          </h2>
          <p>
            DueDesk ("we", "us", or "our") operates a statutory compliance tracking platform designed for Indian businesses and Chartered Accountants. We are committed to processing your personal data lawfully, fairly, and transparently in full accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            2. Personal Data We Collect
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-neutral-400">
            <li><strong>Identity & Contact Information:</strong> Name, work email address, and authentication identifiers.</li>
            <li><strong>Business Profile Data:</strong> Business name, state of registration, turnover bracket, entity type, and masked tax identifiers (e.g., GSTIN, last 4 digits of PAN).</li>
            <li><strong>Filing Evidence & Documents:</strong> Uploaded acknowledgment PDFs and challan receipts stored in private encrypted Cloudflare R2 vaults.</li>
            <li><strong>Technical & Session Logs:</strong> IP address, browser type, and authentication timestamps strictly for security, rate-limiting, and fraud prevention.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            3. Strict Prohibition on Government Portal Credentials
          </h2>
          <div className="p-4 border border-neutral-800 bg-neutral-950 text-white font-semibold">
            DueDesk NEVER asks for, records, processes, or stores your passwords, credentials, or 2FA credentials for the GST Portal, Income Tax Portal, MCA21, or EPFO/ESIC portals.
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            4. Tenant Data Isolation & Security Safeguards
          </h2>
          <p>
            We implement Postgres Row-Level Security (RLS) on all database tables. Your data is isolated by organization ID so no other organization or user can view or query your filings. Document proofs are stored in private Cloudflare R2 buckets with presigned, short-lived URLs.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            5. Your Rights Under DPDP Act, 2023
          </h2>
          <p>
            Under the DPDP Act, you have the right to:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-neutral-400">
            <li><strong>Right to Access:</strong> View and export your complete organization compliance records.</li>
            <li><strong>Right to Correction:</strong> Update or rectify any outdated business profile information.</li>
            <li><strong>Right to Erasure:</strong> Request permanent deletion of your account, organization records, and uploaded filing proofs.</li>
            <li><strong>Right to Grievance Redressal:</strong> Direct questions to our designated Grievance Officer at <span className="text-white">privacy@duedesk.in</span>.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            6. Statutory Disclaimer
          </h2>
          <p className="text-neutral-400 italic">
            DueDesk is an automated reminder utility and does not constitute tax, legal, or accounting advice. Always consult a licensed Chartered Accountant.
          </p>
        </section>
      </main>

      <footer className="border-t border-neutral-900 py-6 text-center text-xs font-mono text-neutral-600">
        &copy; {new Date().getFullYear()} DueDesk Technologies. All rights reserved.
      </footer>
    </div>
  );
}
