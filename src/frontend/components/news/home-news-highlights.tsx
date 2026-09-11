"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { NewsStoryCard } from "@/components/news/news-story-card";
import { useLocale } from "@/components/providers/locale-provider";
import { fashionNewsArticles } from "@/lib/fashion-news";

export function HomeNewsHighlights() {
  const { language, t } = useLocale();
  const featuredStories = fashionNewsArticles.filter(
    (article) => article.homeFeature,
  );

  return (
    <section
      id="news"
      className="scroll-mt-28 border-t border-[var(--line)] py-16 sm:py-20 lg:py-24"
    >
      <div className="mb-9 flex flex-col gap-5 sm:mb-11 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted-soft)]">
            {t("news.eyebrow")}
          </p>
          <h2 className="serif mt-4 max-w-2xl text-4xl leading-[1.02] tracking-[-0.035em] text-[var(--text)] sm:text-5xl">
            {t("news.homeTitle")}
          </h2>
        </div>
        <Link
          className="group inline-flex w-fit items-center gap-3 text-sm font-semibold text-[var(--accent)] transition hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
          href="/news"
        >
          {t("news.viewAll")}
          <ArrowRight
            size={17}
            className="transition-transform group-hover:translate-x-1"
          />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        {featuredStories.map((article, index) => (
          <NewsStoryCard
            key={article.id}
            article={article}
            language={language}
            index={index}
            size={index === 0 ? "hero" : "compact"}
            destination="news"
          />
        ))}
      </div>
    </section>
  );
}
