"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";

export function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const isStoreAdministrator = auth.selectedStore?.status === "active";

  useEffect(() => {
    if (auth.status === "anonymous") {
      router.replace("/login");
      return;
    }

    if (isStoreAdministrator && pathname !== "/" && !pathname.startsWith("/store/")) {
      router.replace("/");
    }
  }, [auth.status, isStoreAdministrator, pathname, router]);

  if (auth.status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="glass soft-shadow hairline rounded-[2rem] px-8 py-6 text-sm text-[var(--muted)]">
          {t("workspace.connecting")}
        </div>
      </main>
    );
  }

  if (isStoreAdministrator && pathname !== "/" && !pathname.startsWith("/store/")) {
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
