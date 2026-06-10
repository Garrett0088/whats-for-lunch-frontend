import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Load Inter from Google Fonts — applied via className on <body>
const inter = Inter({ subsets: ["latin"] });

// <head> metadata shared across every page
export const metadata: Metadata = {
  title: "What's For Lunch",
  description: "Discover and track your favourite lunch spots",
};

// RootLayout wraps every route — this is the one place the nav lives
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Top navigation bar — rendered on every page */}
        <nav className="flex gap-6 px-6 py-3 bg-gray-100 border-b border-gray-200">
          {/* next/link prefetches the destination page on hover */}
          <Link href="/" className="font-medium hover:underline">
            Home
          </Link>
          <Link href="/restaurants" className="font-medium hover:underline">
            Restaurants
          </Link>
          <Link href="/dishes" className="font-medium hover:underline">
            Dishes
          </Link>
          <Link href="/recommend" className="font-medium hover:underline">
            Recommend
          </Link>
        </nav>

        {/* Each route's page.tsx is rendered here as {children} */}
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
