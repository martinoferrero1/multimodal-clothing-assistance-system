import type { Metadata } from "next";

import "@/app/globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";

export const metadata: Metadata = {
  title: "Lookeate",
  description: "Create, combine, and discover personal style with Lookeate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg)] text-[var(--text)] antialiased">
        <LocaleProvider>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
