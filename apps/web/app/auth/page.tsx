"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "../../lib/auth-client";

function AuthForm() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const qMode = searchParams.get("mode");
    if (qMode === "signup" || qMode === "signin") {
      setMode(qMode);
    }
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email,
        password,
      });

      if (res.error) {
        setErrorMessage(res.error.message ?? "Authentication failed. Please verify your credentials.");
      } else {
        setSuccessMessage("Signed in successfully.");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await authClient.signUp.email({
        email,
        name: name.trim() || email.split("@")[0] || "User",
        password,
      });

      if (res.error) {
        setErrorMessage(res.error.message ?? "Sign up failed. Please check your inputs.");
      } else {
        setSuccessMessage("Account created successfully. You are now logged in.");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await authClient.signOut();
      setSuccessMessage("Signed out successfully.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sign out failed.");
    } finally {
      setLoading(false);
    }
  };

  const quickFillExistingUser = () => {
    setEmail("one@gmail.com");
    setPassword("");
    setErrorMessage(null);
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col justify-between items-center p-6 selection:bg-white selection:text-black">
      {/* Top back navigation */}
      <header className="w-full max-w-sm flex justify-between items-center pt-4">
        <Link
          href="/"
          className="text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-white transition-colors"
        >
          ← Home
        </Link>
        <span className="text-xs font-mono tracking-widest uppercase text-neutral-600">
          DueDesk
        </span>
      </header>

      {/* Main card */}
      <div className="w-full max-w-sm border border-neutral-800 bg-black p-6 sm:p-8 rounded-none my-auto">
        {/* Already authenticated view */}
        {session?.user ? (
          <div className="space-y-6">
            <div className="border border-neutral-800 p-4 space-y-2 rounded-none">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                Current Session
              </div>
              <div className="text-sm font-medium text-white truncate">
                {session.user.name || "User"}
              </div>
              <div className="text-xs font-mono text-neutral-400 truncate">
                {session.user.email}
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href="/"
                className="w-full py-2.5 px-4 text-center block text-xs uppercase tracking-wider font-mono font-semibold bg-white text-black hover:bg-neutral-200 border border-white rounded-none transition-colors"
              >
                Go to Home
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full py-2.5 px-4 text-center text-xs uppercase tracking-wider font-mono font-semibold bg-black text-neutral-300 hover:text-white hover:border-white border border-neutral-800 rounded-none transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </div>
        ) : (
          /* Sign In / Sign Up Form */
          <div>
            {/* Mode switcher tabs */}
            <div className="grid grid-cols-2 border border-neutral-800 rounded-none mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`py-2 text-xs font-mono uppercase tracking-wider transition-colors rounded-none cursor-pointer ${
                  mode === "signin"
                    ? "bg-white text-black font-semibold"
                    : "bg-black text-neutral-400 hover:text-white"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`py-2 text-xs font-mono uppercase tracking-wider transition-colors rounded-none cursor-pointer ${
                  mode === "signup"
                    ? "bg-white text-black font-semibold"
                    : "bg-black text-neutral-400 hover:text-white"
                }`}
              >
                Signup
              </button>
            </div>

            {/* Error & Success notices */}
            {errorMessage && (
              <div className="mb-4 p-3 border border-neutral-700 bg-neutral-950 text-neutral-300 text-xs font-mono rounded-none">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 border border-white bg-neutral-950 text-white text-xs font-mono rounded-none">
                {successMessage}
              </div>
            )}

            <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Priya Sharma"
                    className="w-full px-3 py-2.5 rounded-none bg-black border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2.5 rounded-none bg-black border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] font-mono uppercase text-neutral-500 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 rounded-none bg-black border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || sessionLoading}
                className="w-full mt-2 py-3 rounded-none bg-white text-black hover:bg-neutral-200 border border-white font-mono text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? "Processing..." : mode === "signin" ? "Login" : "Sign Up"}
              </button>
            </form>

            {/* Subtle pre-fill helper */}
            <div className="mt-6 pt-4 border-t border-neutral-900 text-center">
              <button
                type="button"
                onClick={quickFillExistingUser}
                className="text-[11px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
              >
                Pre-fill sample user (one@gmail.com)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Statutory disclaimer */}
      <footer className="text-center text-[11px] font-mono text-neutral-600 pb-4">
        <p>Reminder tool, not tax advice. Verify dates with the official portal or your CA.</p>
      </footer>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
      <AuthForm />
    </Suspense>
  );
}
