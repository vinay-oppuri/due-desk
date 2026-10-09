import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col justify-between items-center p-6 selection:bg-white selection:text-black">
      {/* Minimal wordmark */}
      <div className="w-full max-w-sm flex justify-center items-center pt-8">
        <span className="font-mono text-xs tracking-widest uppercase text-neutral-500">
          DueDesk
        </span>
      </div>

      {/* Two action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-xs">
        <Link
          href="/dashboard"
          className="w-full sm:w-36 py-3 text-center text-xs tracking-wider uppercase font-mono font-semibold bg-neutral-900 text-white hover:bg-neutral-800 border border-neutral-700 hover:border-white rounded-none transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/auth?mode=signin"
          className="w-full sm:w-36 py-3 text-center text-xs tracking-wider uppercase font-mono font-semibold bg-white text-black hover:bg-neutral-200 border border-white rounded-none transition-colors"
        >
          Sign In
        </Link>
      </div>

      {/* Statutory disclaimer */}
      <footer className="text-center text-[11px] font-mono text-neutral-600 pb-4">
        <p>
          Reminder tool, not tax advice. Verify dates with the official portal
          or your CA.
        </p>
      </footer>
    </main>
  );
}
