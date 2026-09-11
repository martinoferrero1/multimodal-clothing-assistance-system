"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  MessageCircle,
  Palette,
  Search,
  Shirt,
  Store,
} from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavigation } from "@/components/layout/site-navigation";
import { HomeNewsHighlights } from "@/components/news/home-news-highlights";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
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
  const [betaVisible, setBetaVisible] = useState(false);
  const [betaShimmerVisible, setBetaShimmerVisible] = useState(false);
  const betaSectionRef = useRef<HTMLElement | null>(null);
  const canManageStore = auth.selectedStore?.status === "active";
  const betaTitle = t("home.betaTitle");
  const betaDescription = t("home.betaDescription");
  const betaDescriptionParts = betaDescription.split(/(\s+)/);
  const betaWordCount = betaDescriptionParts.filter((part) => part.trim()).length;

  useEffect(() => {
    const section = betaSectionRef.current;
    if (!section) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      const fallbackTimer = window.setTimeout(() => setBetaVisible(true), 0);
      return () => window.clearTimeout(fallbackTimer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setBetaVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!betaVisible) {
      return;
    }

    const shimmerTimer = window.setTimeout(
      () => setBetaShimmerVisible(true),
      betaWordCount * 70 + 600,
    );
    return () => window.clearTimeout(shimmerTimer);
  }, [betaVisible, betaWordCount]);

  return (
    <main className="home-background relative min-h-screen overflow-x-hidden">
      <div
        className="home-grid pointer-events-none absolute inset-0 opacity-50"
        aria-hidden="true"
      />
      <div
        className="page-orb -left-40 top-16 h-72 w-72 bg-[rgba(208,188,255,0.1)]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[92rem] flex-col px-5 sm:px-8 lg:px-12">
        <SiteNavigation />

        <div className="h-24 shrink-0" aria-hidden="true" />

        <section className="grid flex-1 items-end gap-10 pb-16 pt-20 lg:grid-cols-[minmax(0,1fr)_18rem] lg:pb-20 lg:pt-28">
          <div className="max-w-5xl">
            <h1 className="serif text-[clamp(3.4rem,8vw,7.6rem)] leading-[0.98] tracking-[-0.055em] text-[var(--text)]">
              {t("home.title")}
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
              {t("home.description")}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-zinc-950 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
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
        </section>

        <section
          id="experiences"
          className="scroll-mt-8 border-t border-[var(--line)] py-16 sm:py-20 lg:py-24"
        >
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
                className="home-module-card group flex min-h-[32rem] flex-col justify-between overflow-hidden rounded-[1.4rem] border border-white/20 bg-[linear-gradient(135deg,#17131c_0%,#241a31_45%,#4a3566_100%)] p-6 text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] sm:p-8"
                href="/chat/new"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white">
                    <MessageCircle size={21} />
                  </span>
                </div>

                <div>
                  <h3 className="serif text-5xl leading-[0.94] tracking-[-0.04em] sm:text-6xl">
                    Lookeate Assistant
                  </h3>
                  <p className="mt-6 max-w-[34rem] text-sm leading-7 text-[#f0ebf8] sm:text-base">
                    {t("home.assistantDescription")}
                  </p>
                  <span className="mt-8 inline-flex items-center gap-3 text-sm font-bold text-white">
                    {t("home.assistantAction")}
                    <ArrowUpRight
                      size={17}
                      className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                    />
                  </span>
                </div>
              </Link>

              <div className="grid gap-4">
                {productExperiences.map((experience) => {
                  const Icon = experience.icon;

                  if (experience.id === "style" || experience.id === "catalogs") {
                    return (
                      <Link
                        key={experience.id}
                        className="group flex min-h-[10rem] flex-col justify-between rounded-[1.2rem] border border-[rgba(208,188,255,0.42)] bg-[var(--accent-soft)] p-5 text-[var(--text)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] sm:p-6"
                        href={experience.id === "style" ? "/style" : "/catalog"}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <Icon size={19} className="text-[var(--accent)]" />
                        </div>
                        <div className="mt-7 grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-4">
                          <div>
                            <h3 className="text-lg font-semibold">
                              {t(experience.titleKey)}
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                              {t(experience.descriptionKey)}
                            </p>
                          </div>
                          <ArrowUpRight
                            size={17}
                            className="text-[var(--accent)] transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                          />
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
                        <div>
                          <h3
                            id={`experience-${experience.id}`}
                            className="text-lg font-semibold"
                          >
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

                {canManageStore ? (
                  <Link
                    className="group flex min-h-[10rem] flex-col justify-between rounded-[1.2rem] border border-[rgba(208,188,255,0.42)] bg-[var(--accent-soft)] p-5 text-[var(--text)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] sm:p-6"
                    href="/store/inventory"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <Store size={19} className="text-[var(--accent)]" />
                    </div>
                    <div className="mt-7 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {t("home.storeCatalogTitle")}
                        </h3>
                        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                          {t("home.storeCatalogDescription")}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                        {t("home.storeCatalogAction")}
                        <ArrowUpRight
                          size={17}
                          className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                        />
                      </span>
                    </div>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <HomeNewsHighlights />

        <section ref={betaSectionRef} id="about" className="py-24 sm:py-32 lg:py-40">
          <div className="max-w-6xl">
            <h2 data-text={betaTitle} className={`beta-title relative font-semibold text-[clamp(2.75rem,7vw,7rem)] leading-[0.98] tracking-[-0.065em] ${betaShimmerVisible ? "beta-copy-shimmer" : ""}`}>
              {betaTitle}
            </h2>
            <p className={`serif mt-7 max-w-5xl text-xl font-semibold italic leading-[1.25] tracking-[-0.025em] text-[var(--muted)] sm:mt-9 sm:text-2xl lg:text-3xl ${betaVisible ? "beta-copy-reveal" : "opacity-0"}`}>
              {betaDescriptionParts.map((part, index) => {
                if (!part.trim()) {
                  return part;
                }

                const wordIndex = betaDescriptionParts
                  .slice(0, index)
                  .filter((previousPart) => previousPart.trim()).length;

                return (
                  <span
                    key={`${part}-${index}`}
                    className="beta-copy-word"
                    style={{ animationDelay: `${wordIndex * 70}ms` }}
                  >
                    {part}
                  </span>
                );
              })}
            </p>
          </div>
        </section>

        <SiteFooter />
      </div>

    </main>
  );
}
