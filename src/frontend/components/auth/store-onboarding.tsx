"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { StoreEmailVerificationForm } from "@/components/auth/store-email-verification-form";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";

export function StoreOnboarding() {
  const auth = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const refreshStoreStatus = useEffectEvent(() => auth.refreshStoreStatus());

  useEffect(() => {
    if (auth.status === "anonymous") {
      router.replace("/login");
      return;
    }
    if (auth.status !== "authenticated") {
      return;
    }

    let active = true;
    void refreshStoreStatus()
      .then(() => {
        if (active) setLoaded(true);
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          setLoaded(true);
        }
      });
    return () => { active = false; };
  }, [auth.status, router]);

  if (auth.status !== "authenticated" || !loaded) {
    return <StatusShell><p>{t("store.status.loading")}</p></StatusShell>;
  }

  if (loadError || !auth.selectedStore) {
    return (
      <StatusShell>
        <p>{t("store.status.noStore")}</p>
        <Link className="inline-flex items-center gap-2 font-semibold text-[var(--accent)]" href="/store/register">
          {t("auth.register.storeOption")} <ArrowRight size={16} />
        </Link>
      </StatusShell>
    );
  }

  const store = auth.selectedStore;
  if (store.status === "rejected" || store.status === "suspended") {
    return <StoreStatus title={store.status === "rejected" ? t("store.status.rejected") : t("store.status.suspended")} />;
  }
  if (store.status === "active") {
    return (
      <StoreStatus title={t("store.status.active")}>
        <Link className="inline-flex items-center gap-2 font-semibold text-[var(--accent)]" href="/">
          {t("store.status.openLookeate")} <ArrowRight size={16} />
        </Link>
      </StoreStatus>
    );
  }
  if (!store.email_verified) {
    return (
      <StatusShell>
        <h2 className="serif text-3xl text-[var(--text)]">{t("store.register.acknowledged")}</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">{t("store.register.acknowledgedDescription")}</p>
        <StoreEmailVerificationForm />
      </StatusShell>
    );
  }
  return <StoreStatus title={t("store.status.pendingApproval")} description={t("store.status.pendingApprovalDescription")} />;
}

function StoreStatus({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <StatusShell>
      <h2 className="serif text-3xl text-[var(--text)]">{title}</h2>
      {description ? <p className="text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      <p className="text-sm leading-6 text-[var(--muted)]">{t("store.status.support")}</p>
      {children}
    </StatusShell>
  );
}

function StatusShell({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="glass-strong soft-shadow hairline w-full max-w-xl space-y-6 rounded-[2rem] p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Lookeate</p>
        <h1 className="serif text-4xl text-[var(--text)]">{t("store.status.title")}</h1>
        {children}
      </section>
    </main>
  );
}
