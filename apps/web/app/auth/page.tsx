"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { authClient } from "../../lib/auth-client";

function AuthForm() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  // 'email_entry' -> enter email, 'otp_entry' -> enter 6-digit OTP
  const [step, setStep] = useState<"email_entry" | "otp_entry">("email_entry");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<
    "google" | "github" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown timer for resending OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Handle Social Login (Google / GitHub)
  const handleSocialSignIn = async (provider: "google" | "github") => {
    setErrorMessage(null);
    setSocialLoading(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: "/",
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : `Failed to connect with ${provider}.`,
      );
      setSocialLoading(null);
    }
  };

  // Step 1: Send OTP to Email
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: cleanEmail,
        type: "sign-in",
      });

      if (res.error) {
        setErrorMessage(
          res.error.message ??
            "Could not send verification code. Please check your email.",
        );
      } else {
        setStep("otp_entry");
        setSuccessMessage(
          `We sent a 6-digit verification code to ${cleanEmail}`,
        );
        setResendCooldown(60); // 60s cooldown
        // Focus first OTP input on next tick
        setTimeout(() => {
          otpInputsRef.current[0]?.focus();
        }, 100);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to send verification code.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (enteredOtp?: string) => {
    const code = enteredOtp ?? otp.join("");
    if (code.length !== 6) {
      setErrorMessage("Please enter all 6 digits of the verification code.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: code,
      });

      if (res.error) {
        setErrorMessage(
          res.error.message ?? "Invalid or expired code. Please try again.",
        );
      } else {
        setSuccessMessage(
          "Authenticated successfully! Loading your workspace...",
        );
        setTimeout(() => {
          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
          window.location.href = `${appUrl}/dashboard`;
        }, 500);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Verification failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle individual OTP digit box changes
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Pasted full OTP code or multi-char
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpInputsRef.current[nextIndex]?.focus();

      if (newOtp.every((d) => d !== "")) {
        handleVerifyOtp(newOtp.join(""));
      }
      return;
    }

    const digit = value.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits entered
    if (digit && index === 5 && newOtp.every((d) => d !== "")) {
      handleVerifyOtp(newOtp.join(""));
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await authClient.signOut();
      setSuccessMessage("Signed out successfully.");
      setStep("email_entry");
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sign out failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col justify-between items-center p-6 selection:bg-white selection:text-black">
      {/* Top Header */}
      <header className="w-full max-w-sm flex justify-between items-center pt-4">
        <Link
          href="/"
          className="text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-white transition-colors"
        >
          ← Home
        </Link>
        <span className="text-xs font-mono tracking-widest uppercase text-neutral-500 font-semibold">
          DueDesk
        </span>
      </header>

      {/* Main Auth Card */}
      <div className="w-full max-w-sm border border-neutral-800 bg-neutral-950 p-6 sm:p-8 rounded-none my-auto shadow-2xl">
        {session?.user ? (
          /* Authenticated Session View */
          <div className="space-y-6">
            <div className="border border-neutral-800 p-4 space-y-2 rounded-none bg-black">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                Active Session
              </div>
              <div className="text-sm font-medium text-white truncate">
                {session.user.name || "Compliance Officer"}
              </div>
              <div className="text-xs font-mono text-neutral-400 truncate">
                {session.user.email}
              </div>
            </div>

            <div className="space-y-2">
              <a
                href={`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/dashboard`}
                className="w-full py-2.5 px-4 text-center block text-xs uppercase tracking-wider font-mono font-semibold bg-white text-black hover:bg-neutral-200 border border-white rounded-none transition-colors"
              >
                Open Workspace Dashboard &rarr;
              </a>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full py-2.5 px-4 text-center text-xs uppercase tracking-wider font-mono font-semibold bg-black text-neutral-300 hover:text-white hover:border-neutral-600 border border-neutral-800 rounded-none transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </div>
        ) : (
          /* Passwordless & Social Login Flow */
          <div className="space-y-5">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">
                {step === "email_entry"
                  ? "Sign in to DueDesk"
                  : "Enter Verification Code"}
              </h1>
              <p className="text-xs text-neutral-400 mt-1 font-mono">
                {step === "email_entry"
                  ? "Access your statutory compliance calendar and filings"
                  : `Enter the 6-digit code sent to ${email}`}
              </p>
            </div>

            {/* Error & Success notices */}
            {errorMessage && (
              <div className="p-3 border border-red-900/60 bg-red-950/40 text-red-300 text-xs font-mono rounded-none">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="p-3 border border-emerald-900/60 bg-emerald-950/40 text-emerald-300 text-xs font-mono rounded-none">
                {successMessage}
              </div>
            )}

            {step === "email_entry" ? (
              <>
                {/* Social Login Buttons */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleSocialSignIn("google")}
                    disabled={!!socialLoading || loading}
                    className="w-full py-2.5 px-4 flex items-center justify-center gap-3 text-xs font-mono uppercase tracking-wider bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white rounded-none transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-2.9z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                      />
                    </svg>
                    {socialLoading === "google"
                      ? "Connecting..."
                      : "Continue with Google"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialSignIn("github")}
                    disabled={!!socialLoading || loading}
                    className="w-full py-2.5 px-4 flex items-center justify-center gap-3 text-xs font-mono uppercase tracking-wider bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white rounded-none transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      />
                    </svg>
                    {socialLoading === "github"
                      ? "Connecting..."
                      : "Continue with GitHub"}
                  </button>
                </div>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-800" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest">
                    <span className="bg-neutral-950 px-2 text-neutral-500">
                      or continue with email
                    </span>
                  </div>
                </div>

                {/* Passwordless Email Form */}
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ca@firm.com or founder@startup.in"
                      className="w-full px-3 py-2.5 rounded-none bg-black border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-colors font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || sessionLoading}
                    className="w-full py-3 rounded-none bg-white text-black hover:bg-neutral-200 border border-white font-mono text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading
                      ? "Sending One-Time Code..."
                      : "Continue with Email"}
                  </button>
                </form>
              </>
            ) : (
              /* Step 2: OTP Verification Form */
              <div className="space-y-5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-neutral-400 truncate max-w-[200px]">
                    {email}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email_entry");
                      setOtp(["", "", "", "", "", ""]);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-neutral-400 hover:text-white underline underline-offset-4 cursor-pointer"
                  >
                    Change email
                  </button>
                </div>

                {/* 6 Digit Inputs */}
                <div className="flex justify-between gap-2">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputsRef.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-12 h-14 text-center text-xl font-mono font-bold bg-black border border-neutral-800 text-white focus:outline-none focus:border-white rounded-none transition-colors"
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleVerifyOtp()}
                  disabled={loading || otp.some((d) => d === "")}
                  className="w-full py-3 rounded-none bg-white text-black hover:bg-neutral-200 border border-white font-mono text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>

                <div className="text-center text-xs font-mono text-neutral-500">
                  {resendCooldown > 0 ? (
                    <span>Resend code in {resendCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={loading}
                      className="text-neutral-300 hover:text-white underline underline-offset-4 cursor-pointer"
                    >
                      Didn&apos;t receive code? Resend
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Statutory Disclaimer */}
      <footer className="text-center text-[11px] font-mono text-neutral-600 pb-4 max-w-sm">
        <p>
          Reminder tool, not tax advice. Verify dates with the official portal
          or your CA.
        </p>
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
