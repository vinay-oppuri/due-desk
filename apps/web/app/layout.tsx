import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DueDesk | Statutory Compliance Calendar & Tracker for India",
  description:
    "Never miss a statutory deadline. Personalized, rule-governed compliance calendar for GST, TDS, PF/ESIC, and MCA/ROC filings with automated reminders and private document vault.",
  keywords: [
    "GST due dates",
    "TDS filing deadlines",
    "ROC compliance",
    "Income tax calendar India",
    "CA compliance software",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased selection:bg-white selection:text-black">
        {children}
      </body>
    </html>
  );
}
