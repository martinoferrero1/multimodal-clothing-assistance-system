"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Info, KeyRound, MapPin, Rss, Search, Users } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavigation } from "@/components/layout/site-navigation";
import { useLocale } from "@/components/providers/locale-provider";
import { joinCommunityListingByCode, listCommunityListings, subscribeToCommunityListing, unsubscribeFromCommunityListing } from "@/lib/api-client";
import type { CommunityListing, CommunityListingKind } from "@/lib/types";

const filters: Array<CommunityListingKind | "all"> = ["all", "blog", "event", "space"];

function formatDate(value: string | null | undefined, language: string): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(language === "es" ? "es-AR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function CommunityDiscovery() {
  const { language, t } = useLocale();
  const [listings, setListings] = useState<CommunityListing[]>([]);
  const [activeFilter, setActiveFilter] = useState<CommunityListingKind | "all">("all");
  const [query, setQuery] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);

  useEffect(() => {
    void listCommunityListings().then(setListings).catch(() => setError(t("community.loadError"))).finally(() => setLoading(false));
  }, [t]);

  const visibleListings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return listings.filter((listing) => {
      if (activeFilter !== "all" && listing.kind !== activeFilter) return false;
      if (!normalizedQuery) return true;
      const searchable = [listing.title, listing.description, listing.location, listing.store_display_name, listing.store_handle, t(`community.${listing.kind}` as "community.blog")].filter(Boolean).join(" ").toLocaleLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [activeFilter, listings, query, t]);

  async function toggleSubscription(listing: CommunityListing) {
    if (changingId) return;
    setChangingId(listing.id); setError(null);
    try {
      const result = listing.is_subscribed ? await unsubscribeFromCommunityListing(listing.id) : await subscribeToCommunityListing(listing.id);
      setListings((current) => current.map((item) => item.id === listing.id ? { ...item, is_subscribed: result.is_subscribed } : item));
    } catch { setError(t("community.subscribeError")); } finally { setChangingId(null); }
  }

  async function joinByCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinCode.trim() || joining) return;
    setJoining(true); setError(null); setNotice(null);
    try {
      const result = await joinCommunityListingByCode(joinCode);
      setListings((current) => current.map((item) => item.id === result.listing_id ? { ...item, is_subscribed: result.is_subscribed } : item));
      setJoinCode(""); setNotice(t("community.joined"));
    } catch { setError(t("community.joinError")); } finally { setJoining(false); }
  }

  return <main className="catalog-background relative min-h-screen overflow-x-hidden">
    <div className="home-grid pointer-events-none absolute inset-0 opacity-35" aria-hidden="true" />
    <div className="page-orb -left-32 top-32 h-80 w-80 bg-[rgba(208,188,255,0.1)]" aria-hidden="true" />
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[92rem] flex-col px-5 sm:px-8 lg:px-12">
      <SiteNavigation />
      <div className="h-32 shrink-0 sm:h-36" aria-hidden="true" />
      <section className="pb-12 sm:pb-16" aria-label={t("community.navLabel")}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.55fr)]">
          <label className="glass flex items-center gap-3 rounded-2xl border border-[var(--line)] px-4 py-3 text-[var(--muted)] focus-within:border-[var(--accent)]"><Search size={18} aria-hidden="true" /><span className="sr-only">{t("community.search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("community.searchPlaceholder")} className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]" /></label>
          <form className="glass flex items-center gap-2 rounded-2xl border border-[var(--line)] p-2 pl-4 focus-within:border-[var(--accent)]" onSubmit={(event) => void joinByCode(event)}><KeyRound size={17} className="shrink-0 text-[var(--accent)]" aria-hidden="true" /><label className="sr-only" htmlFor="community-join-code">{t("community.joinCode")}</label><input id="community-join-code" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder={t("community.joinPlaceholder")} className="min-w-0 flex-1 bg-transparent py-1 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]" /><button className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#111] disabled:opacity-60" type="submit" disabled={joining || !joinCode.trim()}>{t("community.join")}</button></form>
        </div>
        <p className="mt-2 px-1 text-xs text-[var(--muted)]">{t("community.joinHint")}</p>
        <div className="mt-7 flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-6">{filters.map((filter) => <button key={filter} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${activeFilter === filter ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"}`} type="button" aria-pressed={activeFilter === filter} onClick={() => setActiveFilter(filter)}>{t(`community.${filter}` as "community.all")}</button>)}<div className="group relative flex"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--accent)] transition group-hover:border-[var(--accent)] group-hover:bg-[var(--accent-soft)]" aria-hidden="true"><Info size={17} /></span><div className="pointer-events-none absolute left-0 top-full z-20 mt-3 w-80 max-w-[calc(100vw-2.5rem)] translate-y-1 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)] opacity-0 shadow-[0_18px_44px_rgba(0,0,0,0.28)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100"><p>{t("community.areasInfoDescription")}</p><a className="mt-3 inline-flex items-center gap-1.5 font-semibold text-[var(--accent)] transition hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]" href="/faq#community-areas">{t("community.moreInfo")}<ArrowUpRight size={14} aria-hidden="true" /></a></div></div></div>
        {error ? <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
        {notice ? <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p> : null}
        {loading ? <p className="mt-10 text-sm text-[var(--muted)]">{t("workspace.connecting")}</p> : null}
        {!loading && visibleListings.length === 0 ? <div className="mt-10 rounded-2xl border border-dashed border-[var(--line-strong)] p-8 text-sm text-[var(--muted)]">{query.trim() ? t("community.searchEmpty") : t("community.empty")}</div> : null}
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleListings.map((listing) => {
          const start = formatDate(listing.starts_at, language);
          const icon = listing.kind === "blog" ? <Rss size={18} /> : listing.kind === "event" ? <CalendarDays size={18} /> : <MapPin size={18} />;
          return <article key={listing.id} className="glass flex min-h-80 flex-col rounded-[1.5rem] border border-[var(--line)] p-6 transition hover:border-[var(--line-strong)]"><div className="flex items-start justify-between gap-4"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">{icon}</span><span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t(`community.${listing.kind}` as "community.blog")}</span></div><div className="mt-9 flex-1"><p className="text-xs font-semibold text-[var(--accent)]">{listing.store_display_name}</p><h2 className="serif mt-3 text-3xl leading-[1.02] tracking-[-0.02em] text-[var(--text)]">{listing.title}</h2>{listing.description ? <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{listing.description}</p> : null}{listing.location || start ? <div className="mt-5 space-y-2 text-xs text-[var(--muted-soft)]">{listing.location ? <p className="flex items-center gap-2"><MapPin size={14} />{listing.location}</p> : null}{start ? <p className="flex items-center gap-2"><CalendarDays size={14} />{start}</p> : null}</div> : null}</div><div className="mt-7 flex items-center gap-3 border-t border-[var(--line)] pt-5"><button className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${listing.is_subscribed ? "border border-[var(--line-strong)] text-[var(--text)] hover:bg-[var(--surface-high)]" : "bg-white text-[#111] hover:bg-[var(--accent)]"}`} type="button" disabled={changingId === listing.id} onClick={() => void toggleSubscription(listing)}><Users size={15} />{listing.is_subscribed ? t("community.following") : t("community.follow")}</button>{listing.external_url ? <a className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--accent)] transition hover:bg-[var(--accent-soft)]" href={listing.external_url} target="_blank" rel="noreferrer" aria-label={t("community.visit")}><ArrowUpRight size={16} /></a> : null}</div></article>;
        })}</div>
      </section>
      <SiteFooter />
    </div>
  </main>;
}
