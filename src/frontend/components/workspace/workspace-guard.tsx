"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";

export function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "anonymous") {
      router.replace("/login");
    }
  }, [auth.status, router]);

  if (auth.status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="glass soft-shadow hairline rounded-[2rem] px-8 py-6 text-sm text-[var(--muted)]">
          {t("workspace.connecting")}
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
