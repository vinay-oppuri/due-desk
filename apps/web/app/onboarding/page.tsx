"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";

const INDIAN_STATES = [
  { code: "KA", name: "Karnataka" },
  { code: "MH", name: "Maharashtra" },
  { code: "TS", name: "Telangana" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "WB", name: "West Bengal" },
  { code: "DL", name: "Delhi" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "RJ", name: "Rajasthan" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "KL", name: "Kerala" },
];

const BUSINESS_TYPES = [
  { id: "pvt_ltd", name: "Private Limited Company" },
  { id: "llp", name: "Limited Liability Partnership (LLP)" },
  { id: "proprietorship", name: "Sole Proprietorship" },
  { id: "partnership", name: "Partnership Firm" },
  { id: "individual", name: "Individual / Freelancer" },
];

const TURNOVER_BRACKETS = [
  { id: "<40L", name: "Under ₹40 Lakhs" },
  { id: "40L-1.5Cr", name: "₹40 Lakhs to ₹1.5 Crore" },
  { id: "1.5Cr-5Cr", name: "₹1.5 Crore to ₹5 Crore" },
  { id: ">5Cr", name: "Above ₹5 Crore" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("pvt_ltd");
  const [state, setState] = useState("KA");
  const [turnoverBracket, setTurnoverBracket] = useState("1.5Cr-5Cr");
  const [hasEmployees, setHasEmployees] = useState(true);

  // Registrations
  const [gst, setGst] = useState(true);
  const [qrmp, setQrmp] = useState(false);
  const [pf, setPf] = useState(true);
  const [esi, setEsi] = useState(false);
  const [pt, setPt] = useState(true);

  const [gstin, setGstin] = useState("");
  const [panLast4, setPanLast4] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          businessType,
          state,
          turnoverBracket,
          hasEmployees,
          gstin: gstin.trim() || undefined,
          panLast4: panLast4.trim() || undefined,
          registrations: {
            gst,
            qrmp: gst && qrmp,
            pf,
            esi,
            pt,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.message || "Failed to set up business profile.",
        );
      }

      // On successful creation, navigate straight to the compliance calendar
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col justify-between items-center p-6 selection:bg-white selection:text-black">
      {/* Top Header */}
      <header className="w-full max-w-xl flex justify-between items-center pt-4">
        <Link
          href="/dashboard"
          className="text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-white transition-colors"
        >
          ← Dashboard
        </Link>
        <span className="text-xs font-mono tracking-widest uppercase text-neutral-500 font-semibold">
          DueDesk &bull; Setup
        </span>
      </header>

      {/* Main Wizard Card */}
      <div className="w-full max-w-xl border border-neutral-800 bg-neutral-950 p-6 sm:p-8 rounded-none my-8 shadow-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Set Up Your Business Profile
          </h1>
          <p className="text-xs text-neutral-400 mt-1 font-mono">
            We will automatically generate your personalized statutory
            compliance calendar.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 border border-red-900/60 bg-red-950/40 text-red-300 text-xs font-mono rounded-none">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Entity Details */}
          <div className="space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-wider text-neutral-400 border-b border-neutral-900 pb-2">
              1. Business Details
            </h2>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                Business Legal Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Innovations Private Limited"
                className="w-full px-3 py-2.5 rounded-none bg-black border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-colors font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                  Business Structure *
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-none bg-black border border-neutral-800 text-sm text-white focus:outline-none focus:border-white transition-colors font-mono"
                >
                  {BUSINESS_TYPES.map((b) => (
                    <option
                      key={b.id}
                      value={b.id}
                      className="bg-neutral-900 text-white"
                    >
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                  State of Registration *
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-none bg-black border border-neutral-800 text-sm text-white focus:outline-none focus:border-white transition-colors font-mono"
                >
                  {INDIAN_STATES.map((s) => (
                    <option
                      key={s.code}
                      value={s.code}
                      className="bg-neutral-900 text-white"
                    >
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                Annual Turnover Bracket *
              </label>
              <select
                value={turnoverBracket}
                onChange={(e) => setTurnoverBracket(e.target.value)}
                className="w-full px-3 py-2.5 rounded-none bg-black border border-neutral-800 text-sm text-white focus:outline-none focus:border-white transition-colors font-mono"
              >
                {TURNOVER_BRACKETS.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    className="bg-neutral-900 text-white"
                  >
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Registrations & Operations */}
          <div className="space-y-4 pt-2">
            <h2 className="text-xs font-mono uppercase tracking-wider text-neutral-400 border-b border-neutral-900 pb-2">
              2. Compliance & Registrations
            </h2>

            {/* Has employees */}
            <div className="flex items-center gap-3 p-3 border border-neutral-800/80 bg-black">
              <input
                type="checkbox"
                id="hasEmployees"
                checked={hasEmployees}
                onChange={(e) => setHasEmployees(e.target.checked)}
                className="w-4 h-4 accent-white rounded-none cursor-pointer"
              />
              <label
                htmlFor="hasEmployees"
                className="text-xs font-mono text-neutral-300 cursor-pointer"
              >
                Business has active salaried employees (payroll enabled)
              </label>
            </div>

            {/* Registration checks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 border border-neutral-800/80 bg-black space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="regGst"
                    checked={gst}
                    onChange={(e) => setGst(e.target.checked)}
                    className="w-4 h-4 accent-white rounded-none cursor-pointer"
                  />
                  <label
                    htmlFor="regGst"
                    className="text-xs font-mono text-neutral-300 cursor-pointer"
                  >
                    GST Registered (GSTR-1, 3B)
                  </label>
                </div>

                {gst && (
                  <div className="pl-7 pt-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="regQrmp"
                      checked={qrmp}
                      onChange={(e) => setQrmp(e.target.checked)}
                      className="w-3.5 h-3.5 accent-white rounded-none cursor-pointer"
                    />
                    <label
                      htmlFor="regQrmp"
                      className="text-[11px] font-mono text-neutral-400 cursor-pointer"
                    >
                      Enrolled in QRMP quarterly scheme
                    </label>
                  </div>
                )}
              </div>

              <div className="p-3 border border-neutral-800/80 bg-black flex items-center gap-3">
                <input
                  type="checkbox"
                  id="regPt"
                  checked={pt}
                  onChange={(e) => setPt(e.target.checked)}
                  className="w-4 h-4 accent-white rounded-none cursor-pointer"
                />
                <label
                  htmlFor="regPt"
                  className="text-xs font-mono text-neutral-300 cursor-pointer"
                >
                  Professional Tax (PT)
                </label>
              </div>

              <div className="p-3 border border-neutral-800/80 bg-black flex items-center gap-3">
                <input
                  type="checkbox"
                  id="regPf"
                  checked={pf}
                  onChange={(e) => setPf(e.target.checked)}
                  className="w-4 h-4 accent-white rounded-none cursor-pointer"
                />
                <label
                  htmlFor="regPf"
                  className="text-xs font-mono text-neutral-300 cursor-pointer"
                >
                  Provident Fund (EPF ECR)
                </label>
              </div>

              <div className="p-3 border border-neutral-800/80 bg-black flex items-center gap-3">
                <input
                  type="checkbox"
                  id="regEsi"
                  checked={esi}
                  onChange={(e) => setEsi(e.target.checked)}
                  className="w-4 h-4 accent-white rounded-none cursor-pointer"
                />
                <label
                  htmlFor="regEsi"
                  className="text-xs font-mono text-neutral-300 cursor-pointer"
                >
                  ESIC Contribution
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || sessionLoading}
            className="w-full py-3.5 rounded-none bg-white text-black hover:bg-neutral-200 border border-white font-mono text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading
              ? "Generating Compliance Deadlines..."
              : "Save Business & Build Calendar"}
          </button>
        </form>
      </div>

      {/* Statutory Disclaimer */}
      <footer className="text-center text-[11px] font-mono text-neutral-600 pb-4 max-w-xl">
        <p>
          Reminder tool, not tax advice. Verify dates with the official portal
          or your CA.
        </p>
      </footer>
    </main>
  );
}
