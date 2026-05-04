import type { Metadata } from "next";

import "@/app/globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";

export const metadata: Metadata = {
  title: "Stylist AI",
  description: "Next.js frontend for the multimodal clothing assistant.",
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
