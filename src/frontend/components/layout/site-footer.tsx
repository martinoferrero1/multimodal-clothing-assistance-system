"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { SettingsDialog } from "@/components/settings/settings-dialog";

export function SiteFooter() {
  const auth = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canManageStore = auth.selectedStore?.status === "active";

  async function handleSignOut() {
    await auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <footer className="relative left-1/2 mt-8 w-screen -translate-x-1/2 overflow-hidden border-x-0 border-b-0 border-t border-[var(--line-strong)] bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.11),transparent_58%),linear-gradient(180deg,rgba(27,27,27,0.9),rgba(14,14,14,0.96))] px-6 pb-8 pt-14 sm:px-10 sm:pb-10 sm:pt-16 lg:px-12 lg:pt-20">
        <div className="mx-auto grid w-full max-w-[92rem] gap-12 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1.2fr)_repeat(4,minmax(0,1fr))] lg:gap-8">
          <div className="flex flex-col justify-between gap-10 sm:col-span-2 lg:col-span-1">
            <div>
              <div className="flex items-center gap-3 text-[var(--text)]">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-strong)] bg-white/[0.04] text-[var(--accent)]">
                  <Sparkles size={18} />
                </span>
                <span className="serif text-3xl leading-none">Lookeate</span>
              </div>
              <p className="mt-5 max-w-xs text-sm leading-6 text-[var(--muted)]">
                {t("footer.description")}
              </p>
            </div>
            <p className="text-sm text-[var(--muted-soft)]">
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </p>
          </div>

          <nav aria-label={t("footer.product")}>
            <p className="text-sm font-semibold text-[var(--text)]">{t("footer.product")}</p>
            <ul className="mt-5 space-y-3 text-sm text-[var(--muted)]">
              <li><Link className="transition hover:text-[var(--text)]" href="/chat/new">{t("sidebar.assistant")}</Link></li>
              <li><Link className="transition hover:text-[var(--text)]" href="/style">{t("home.styleTitle")}</Link></li>
              <li><Link className="transition hover:text-[var(--text)]" href="/catalog">{t("home.catalogTitle")}</Link></li>
              <li><Link className="transition hover:text-[var(--text)]" href="/favorites">{t("favorites.title")}</Link></li>
              <li><Link className="transition hover:text-[var(--text)]" href="/news">{t("news.navLabel")}</Link></li>
              {canManageStore ? <li><Link className="transition hover:text-[var(--text)]" href="/store/inventory">{t("home.storeCatalogTitle")}</Link></li> : null}
            </ul>
          </nav>

          <nav aria-label={t("footer.lookeate")}>
            <p className="text-sm font-semibold text-[var(--text)]">{t("footer.lookeate")}</p>
            <ul className="mt-5 space-y-3 text-sm text-[var(--muted)]">
              <li><Link className="transition hover:text-[var(--text)]" href="/">{t("footer.home")}</Link></li>
              <li><Link className="transition hover:text-[var(--text)]" href="#about">{t("footer.about")}</Link></li>
              <li><Link className="transition hover:text-[var(--text)]" href="#about">{t("footer.beta")}</Link></li>
            </ul>
          </nav>

          <nav aria-label={t("footer.explore")}>
            <p className="text-sm font-semibold text-[var(--text)]">{t("footer.explore")}</p>
            <ul className="mt-5 space-y-3 text-sm text-[var(--muted)]">
              <li><Link className="transition hover:text-[var(--text)]" href="#experiences">{t("footer.experiences")}</Link></li>
              <li><Link className="transition hover:text-[var(--text)]" href="/chat/new">{t("footer.conversations")}</Link></li>
              <li><Link className="transition hover:text-[var(--text)]" href="/style">{t("footer.style")}</Link></li>
            </ul>
          </nav>

          <div>
            <p className="text-sm font-semibold text-[var(--text)]">{t("footer.account")}</p>
            <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
              <button className="block transition hover:text-[var(--text)]" type="button" onClick={() => setSettingsOpen(true)}>
                {t("sidebar.settings")}
              </button>
              <button className="block transition hover:text-[var(--text)]" type="button" onClick={() => void handleSignOut()}>
                {t("sidebar.signOut")}
              </button>
            </div>
          </div>
        </div>
      </footer>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
