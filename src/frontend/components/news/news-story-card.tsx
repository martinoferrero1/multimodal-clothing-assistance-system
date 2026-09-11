import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { Language } from "@/lib/i18n";
import { languageLocale } from "@/lib/i18n";
import {
  type FashionNewsArticle,
  type FashionNewsTone,
  localizeFashionNews,
} from "@/lib/fashion-news";

const toneClasses: Record<FashionNewsTone, string> = {
  violet:
    "border-[#bca4e7]/35 bg-[radial-gradient(circle_at_82%_20%,rgba(226,209,255,0.28),transparent_24%),linear-gradient(140deg,#17131c_0%,#352746_54%,#684f86_100%)]",
  silver:
    "border-white/25 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.24),transparent_25%),linear-gradient(140deg,#141719_0%,#354046_55%,#718087_100%)]",
  rose:
    "border-[#d9aebd]/30 bg-[radial-gradient(circle_at_78%_18%,rgba(255,218,230,0.2),transparent_25%),linear-gradient(140deg,#1a1417_0%,#452934_55%,#795166_100%)]",
  sage:
    "border-[#aec8b5]/30 bg-[radial-gradient(circle_at_80%_18%,rgba(220,255,228,0.18),transparent_25%),linear-gradient(140deg,#121815_0%,#293c32_55%,#526e5d_100%)]",
  ink:
    "border-white/20 bg-[radial-gradient(circle_at_76%_14%,rgba(255,255,255,0.12),transparent_24%),linear-gradient(140deg,#0d0d0f_0%,#222329_58%,#3d3d45_100%)]",
  sand:
    "border-[#d3c0a7]/30 bg-[radial-gradient(circle_at_78%_18%,rgba(255,236,207,0.18),transparent_25%),linear-gradient(140deg,#181512_0%,#43382d_55%,#77624d_100%)]",
};

type NewsStoryCardProps = {
  article: FashionNewsArticle;
  language: Language;
  index: number;
  size?: "hero" | "standard" | "compact";
  destination?: "news" | "source";
};

export function NewsStoryCard({
  article,
  language,
  index,
  size = "standard",
  destination = "source",
}: NewsStoryCardProps) {
  const story = localizeFashionNews(article, language);
  const formattedDate = new Intl.DateTimeFormat(languageLocale(language), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${article.publishedAt}T00:00:00Z`));
  const href = destination === "news" ? `/news#${article.id}` : article.url;
  const sizeClasses =
    size === "hero"
      ? "min-h-[31rem] p-7 sm:p-9 lg:p-10"
      : size === "compact"
        ? "min-h-[21rem] p-6"
        : "min-h-[25rem] p-6 sm:p-7";

  const content = (
    <>
      <div
        className="pointer-events-none absolute -right-10 -top-14 font-serif text-[12rem] leading-none text-white/[0.055] sm:text-[15rem]"
        aria-hidden="true"
      >
        {String(index + 1).padStart(2, "0")}
      </div>
      <div
        className="pointer-events-none absolute bottom-[-6rem] right-[-3rem] h-64 w-64 rounded-full border border-white/10"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <span className="rounded-full border border-white/20 bg-black/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/85 backdrop-blur-sm">
          {story.category}
        </span>
        <ArrowUpRight
          size={18}
          className="shrink-0 text-white/80 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
        />
      </div>

      <div className="relative z-10 mt-auto max-w-2xl">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
          <span>{article.source}</span>
          <span aria-hidden="true">•</span>
          <time dateTime={article.publishedAt}>{formattedDate}</time>
        </div>
        <h3
          className={`serif mt-4 leading-[1.01] tracking-[-0.035em] text-white ${
            size === "hero"
              ? "text-4xl sm:text-5xl lg:text-6xl"
              : size === "compact"
                ? "text-3xl"
                : "text-3xl sm:text-4xl"
          }`}
        >
          {story.title}
        </h3>
        <p
          className={`mt-4 leading-6 text-white/75 ${
            size === "hero" ? "max-w-xl text-sm sm:text-base" : "text-sm"
          }`}
        >
          {story.summary}
        </p>
      </div>
    </>
  );

  const className = `group relative flex overflow-hidden rounded-[1.5rem] border text-left shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-white/40 hover:shadow-[0_24px_55px_rgba(0,0,0,0.34)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] ${sizeClasses} ${toneClasses[article.tone]}`;

  if (destination === "news") {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {content}
    </a>
  );
}
