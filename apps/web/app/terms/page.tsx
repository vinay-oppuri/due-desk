import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | DueDesk Compliance Tracker",
  description:
    "Terms of Service governing the use of DueDesk. Includes statutory reminder tool disclaimers and limitation of liability.",
};

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-neutral-500">
            Last Updated: October 2026
          </p>
        </div>

        <section className="space-y-3">
          <div className="p-4 border border-amber-600/60 bg-amber-950/20 text-amber-200">
            <strong>MANDATORY STATUTORY DISCLAIMER:</strong> DueDesk is an informational reminder tool and deadline tracker. It does NOT constitute legal, tax, accounting, or audit advice. Always verify statutory deadlines and filing statuses with the official government portals (GSTN, Income Tax e-Filing, MCA21) or consult a qualified Chartered Accountant.
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            1. Nature of the Service
          </h2>
          <p>
            DueDesk provides deterministic, rule-based calendars and reminder dispatch via email and calendar feeds (.ics). DueDesk does not prepare, file, or submit tax returns or statutory forms on your behalf.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            2. Best-Effort Delivery & Calendar Sync
          </h2>
          <p>
            While our reminder pipeline incorporates exponential backoff, dead-letter recovery, and daily self-healing watchdogs, reminder delivery across electronic channels is subject to network latency, spam filters, and third-party ISP factors. We strongly advise users to subscribe to their personalized .ics calendar feed as an additional fail-safe layer.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            3. Subscription & Billing
          </h2>
          <p>
            Paid plans (Standard and Pro) are processed securely through Razorpay hosted checkout. We never store or handle raw credit/debit card numbers. In the event of a failed subscription renewal, we offer a 7-day grace period to ensure deadline tracking is not abruptly severed immediately prior to statutory cut-offs.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            4. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by Indian law, DueDesk and its operators shall not be liable for any late filing fees, interest charges under the Income-tax Act or CGST Act, or statutory fines resulting from missed filings or government portal downtime.
          </p>
        </section>
      </main>

      <footer className="border-t border-neutral-900 py-6 text-center text-xs font-mono text-neutral-600">
        &copy; {new Date().getFullYear()} DueDesk Technologies. All rights reserved.
      </footer>
    </div>
  );
}
