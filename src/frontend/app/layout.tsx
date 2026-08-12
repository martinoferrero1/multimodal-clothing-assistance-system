import type { Metadata } from "next";

import "@/app/globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";

export const metadata: Metadata = {
  title: "Lookeate",
  description: "Next.js frontend for Lookeate, an AI-powered fashion assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg)] text-[var(--text)] antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
