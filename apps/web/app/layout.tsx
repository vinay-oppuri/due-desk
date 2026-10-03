import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Finance App',
  description: 'A secure finance application.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
