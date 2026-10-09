import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DueDesk Workspace | Statutory Compliance Platform",
  description: "Personalized statutory compliance calendar and filings for businesses and CA firms.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
