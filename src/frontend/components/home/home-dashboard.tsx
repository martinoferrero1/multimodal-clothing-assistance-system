"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronDown,
  LogOut,
  MessageCircle,
  Palette,
  Search,
  Settings,
  Shirt,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import type { MessageKey } from "@/lib/i18n";

const productExperiences: Array<{
  id: string;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: typeof Shirt;
}> = [
  {
    id: "garment",
    titleKey: "home.garmentTitle",
    descriptionKey: "home.garmentDescription",
    icon: Shirt,
  },
  {
    id: "style",
    titleKey: "home.styleTitle",
    descriptionKey: "home.styleDescription",
    icon: Palette,
  },
  {
    id: "catalogs",
    titleKey: "home.catalogTitle",
    descriptionKey: "home.catalogDescription",
    icon: Search,
  },
];

export function HomeDashboard() {
  const auth = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const displayName = auth.user?.display_name?.trim() || t("common.account");
  const accountInitial = displayName.slice(0, 1).toLocaleUpperCase();

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  async function handleSignOut() {
    setAccountMenuOpen(false);
    await auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="home-background relative min-h-screen overflow-hidden">
      <div className="home-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="page-orb -left-40 top-16 h-96 w-96 bg-[rgba(208,188,255,0.1)]" aria-hidden="true" />
      <div className="page-orb -right-40 top-[38rem] h-[28rem] w-[28rem] bg-white/[0.05]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[92rem] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-[var(--line)] py-5 sm:py-6">
          <div className="flex items-center gap-4">
            <Link
              className="serif text-3xl leading-none text-[var(--text)] transition hover:opacity-80 sm:text-[2.15rem]"
              href="/"
            >
              Lookeate
            </Link>
            <span className="rounded-full border border-[var(--line-strong)] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              {t("common.beta")}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <nav className="hidden items-center gap-7 text-sm text-[var(--muted)] md:flex" aria-label={t("home.primaryNavigation")}>
              <span className="font-semibold text-[var(--text)]">{t("sidebar.home")}</span>
              <Link className="transition hover:text-[var(--text)]" href="/chat/new">
                {t("sidebar.assistant")}
              </Link>
            </nav>

            <div className="relative" ref={accountMenuRef}>
              <button
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white/[0.035] p-1.5 pr-2.5 text-sm text-[var(--text)] transition hover:border-[var(--line-strong)] hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:pr-4"
                type="button"
                aria-label={t("home.openAccountMenu")}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--text)] text-xs font-bold text-[var(--bg-strong)]">
                  {accountInitial}
                </span>
                <span className="hidden max-w-32 truncate sm:inline">{displayName}</span>
                <ChevronDown size={14} className={`transition ${accountMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {accountMenuOpen ? (
                <div
                  className="floating-shadow absolute right-0 top-[calc(100%+0.65rem)] z-40 w-56 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-2"
                  role="menu"
                >
                  <button
                    className="option-row flex w-full items-center gap-3 px-3 py-3 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-high)]"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setSettingsOpen(true);
                    }}
                  >
                    <Settings size={16} />
                    {t("sidebar.settings")}
                  </button>
                  <button
                    className="option-row flex w-full items-center gap-3 px-3 py-3 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-high)]"
                    type="button"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                  >
                    <LogOut size={16} />
                    {t("sidebar.signOut")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="grid flex-1 items-end gap-10 pb-16 pt-20 lg:grid-cols-[minmax(0,1fr)_18rem] lg:pb-20 lg:pt-28">
          <div className="max-w-5xl animate-rise-in">
            <div className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
              <Sparkles size={15} className="text-[var(--accent)]" />
              {t("home.eyebrow")}
            </div>
            <h1 className="serif text-[clamp(3.4rem,8vw,7.6rem)] leading-[0.9] tracking-[-0.055em] text-[var(--text)]">
              {t("home.title")}
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
              {t("home.description")}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                className="inline-flex items-center gap-3 rounded-full bg-[var(--text)] px-6 py-3.5 text-sm font-semibold text-[var(--bg-strong)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
                href="/chat/new"
              >
                {t("home.openAssistant")}
                <ArrowUpRight size={17} />
              </Link>
              <a
                className="inline-flex items-center gap-3 rounded-full border border-[var(--line)] px-6 py-3.5 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
                href="#experiences"
              >
                {t("home.exploreExperiences")}
                <ArrowDown size={16} />
              </a>
            </div>
          </div>

          <div className="hidden justify-self-end border-l border-[var(--line)] pl-7 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-soft)]">
              {t("home.betaLabel")}
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {t("home.betaSummary")}
            </p>
          </div>
        </section>

        <section id="experiences" className="scroll-mt-8 border-t border-[var(--line)] py-16 sm:py-20 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted-soft)]">
                {t("home.experiencesEyebrow")}
              </p>
              <h2 className="serif mt-5 max-w-xl text-4xl leading-[1.02] tracking-[-0.03em] text-[var(--text)] sm:text-5xl">
                {t("home.experiencesTitle")}
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)]">
                {t("home.experiencesDescription")}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.88fr)]">
              <Link
                className="home-module-card group flex min-h-[32rem] flex-col justify-between overflow-hidden rounded-[1.4rem] border border-white/55 bg-[linear-gradient(145deg,#f0eded_0%,#ddd7e3_58%,#cfc0ed_100%)] p-6 text-[#171617] shadow-[0_30px_80px_rgba(0,0,0,0.24)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] sm:p-8"
                href="/chat/new"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-black/15 bg-black/[0.04]">
                    <MessageCircle size={21} />
                  </span>
                  <span className="rounded-full border border-black/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em]">
                    {t("common.available")}
                  </span>
                </div>

                <div>
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.26em] text-black/55">01</p>
                  <h3 className="serif text-5xl leading-[0.94] tracking-[-0.04em] sm:text-6xl">
                    Lookeate Assistant
                  </h3>
                  <p className="mt-6 max-w-xl text-sm leading-7 text-black/65 sm:text-base">
                    {t("home.assistantDescription")}
                  </p>
                  <span className="mt-8 inline-flex items-center gap-3 text-sm font-bold">
                    {t("home.assistantAction")}
                    <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </span>
                </div>
              </Link>

              <div className="grid gap-4">
                {productExperiences.map((experience, index) => {
                  const Icon = experience.icon;

                  if (experience.id === "style") {
                    return (
                      <Link
                        key={experience.id}
                        className="group flex min-h-[10rem] flex-col justify-between rounded-[1.2rem] border border-[rgba(208,188,255,0.42)] bg-[var(--accent-soft)] p-5 text-[var(--text)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] sm:p-6"
                        href="/style"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <Icon size={19} className="text-[var(--accent)]" />
                          <span className="rounded-full border border-[rgba(208,188,255,0.4)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                            {t("common.available")}
                          </span>
                        </div>
                        <div className="mt-7 grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-4">
                          <span className="pt-1 text-[10px] font-semibold tracking-[0.2em] text-[var(--muted-soft)]">
                            0{index + 2}
                          </span>
                          <div>
                            <h3 className="text-lg font-semibold">{t(experience.titleKey)}</h3>
                            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t(experience.descriptionKey)}</p>
                          </div>
                          <ArrowUpRight size={17} className="text-[var(--accent)] transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <article
                      key={experience.id}
                      className="flex min-h-[10rem] flex-col justify-between rounded-[1.2rem] border border-[var(--line)] bg-white/[0.035] p-5 text-[var(--text)] sm:p-6"
                      aria-labelledby={`experience-${experience.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <Icon size={19} className="text-[var(--muted)]" />
                        <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-soft)]">
                          {t("common.comingSoon")}
                        </span>
                      </div>
                      <div className="mt-7 grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                        <span className="pt-1 text-[10px] font-semibold tracking-[0.2em] text-[var(--muted-soft)]">
                          0{index + 2}
                        </span>
                        <div>
                          <h3 id={`experience-${experience.id}`} className="text-lg font-semibold">
                            {t(experience.titleKey)}
                          </h3>
                          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                            {t(experience.descriptionKey)}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 border-t border-[var(--line)] py-10 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:py-12">
          <span className="w-fit rounded-full border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            {t("common.beta")}
          </span>
          <div className="max-w-3xl sm:pl-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">{t("home.betaTitle")}</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t("home.betaDescription")}</p>
          </div>
        </section>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
