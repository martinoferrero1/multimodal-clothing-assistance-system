"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Clock3 } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavigation } from "@/components/layout/site-navigation";
import { NewsStoryCard } from "@/components/news/news-story-card";
import { useLocale } from "@/components/providers/locale-provider";
import { fashionNewsArticles } from "@/lib/fashion-news";

export function FashionNews() {
  const { language, t } = useLocale();
  const [leadStory, ...latestStories] = fashionNewsArticles;

  return (
    <main className="catalog-background relative min-h-screen overflow-x-hidden">
      <div
        className="home-grid pointer-events-none absolute inset-0 opacity-35"
        aria-hidden="true"
      />
      <div
        className="page-orb -right-32 top-28 h-80 w-80 bg-[rgba(208,188,255,0.1)]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[92rem] flex-col px-5 sm:px-8 lg:px-12">
        <SiteNavigation />

        <div className="h-32 shrink-0 sm:h-36" aria-hidden="true" />

        <header className="border-b border-[var(--line)] pb-12 pt-8 sm:pb-16 sm:pt-12 lg:pb-20">
          <Link
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] transition hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
            href="/"
          >
            <ArrowLeft size={15} />
            {t("news.backHome")}
          </Link>

          <div className="mt-10 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.38fr)] lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                {t("news.eyebrow")}
              </p>
              <h1 className="serif mt-5 max-w-4xl text-[clamp(3.4rem,7vw,7rem)] leading-[0.94] tracking-[-0.055em] text-[var(--text)]">
                {t("news.title")}
              </h1>
            </div>
            <div>
              <p className="text-sm leading-7 text-[var(--muted)]">
                {t("news.description")}
              </p>
              <p className="mt-5 inline-flex items-center gap-2 text-xs text-[var(--muted-soft)]">
                <Clock3 size={14} />
                {t("news.curatedNote")}
              </p>
            </div>
          </div>
        </header>

        <section className="py-12 sm:py-16 lg:py-20" aria-labelledby="news-featured-title">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted-soft)]">
                {t("news.featured")}
              </p>
              <h2 id="news-featured-title" className="serif mt-3 text-3xl text-[var(--text)] sm:text-4xl">
                {t("news.featuredTitle")}
              </h2>
            </div>
            <a
              className="hidden items-center gap-2 text-xs font-semibold text-[var(--accent)] transition hover:text-[var(--text)] sm:inline-flex"
              href={leadStory.url}
              target="_blank"
              rel="noreferrer"
            >
              {t("news.readOriginal")}
              <ArrowUpRight size={15} />
            </a>
          </div>
          <article id={leadStory.id} className="scroll-mt-32">
            <NewsStoryCard
              article={leadStory}
              language={language}
              index={0}
              size="hero"
            />
          </article>
        </section>

        <section className="border-t border-[var(--line)] py-12 sm:py-16 lg:py-20" aria-labelledby="news-latest-title">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted-soft)]">
              {t("news.latest")}
            </p>
            <h2 id="news-latest-title" className="serif mt-3 text-3xl text-[var(--text)] sm:text-4xl">
              {t("news.latestTitle")}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {latestStories.map((article, index) => (
              <article key={article.id} id={article.id} className="scroll-mt-32">
                <NewsStoryCard
                  article={article}
                  language={language}
                  index={index + 1}
                />
              </article>
            ))}
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
