import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | DueDesk Compliance Tracker",
  description:
    "Refund and cancellation terms for paid subscriptions on DueDesk.",
};

export default function RefundPage() {
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
            Refund & Cancellation Policy
          </h1>
          <p className="text-neutral-500">
            Last Updated: October 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            1. Subscription Cancellations
          </h2>
          <p>
            You may cancel your Standard or Pro subscription at any time directly through your billing portal. Upon cancellation, your subscription will remain active until the end of the current billing cycle, and no further recurring charges will be initiated.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            2. 7-Day Money-Back Guarantee
          </h2>
          <p>
            If you upgrade to a paid plan and determine that DueDesk does not meet your firm's compliance tracking requirements, you may request a 100% full refund within 7 days of your initial payment. Send an email to <span className="text-white">billing@duedesk.in</span> with your organization name and invoice ID.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase text-neutral-200">
            3. Processing Time
          </h2>
          <p>
            Approved refunds are credited back to the original source payment method (UPI, credit/debit card, net banking) via our Razorpay payment gateway within 5 to 7 business days.
          </p>
        </section>
      </main>

      <footer className="border-t border-neutral-900 py-6 text-center text-xs font-mono text-neutral-600">
        &copy; {new Date().getFullYear()} DueDesk Technologies. All rights reserved.
      </footer>
    </div>
  );
}
