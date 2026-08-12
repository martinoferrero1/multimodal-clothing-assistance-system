"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";

export default function HomePage() {
  const auth = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace("/chat/new");
      return;
    }

    if (auth.status === "guest") {
      router.replace("/login");
    }
  }, [auth.status, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="glass soft-shadow hairline rounded-[2rem] px-8 py-6 text-sm text-[var(--muted)]">
        {t("home.preparing")}
      </div>
    </main>
  );
}
