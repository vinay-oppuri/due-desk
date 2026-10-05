import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance App Docs",
  description: "Finance App documentation.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
