"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { ArrowRight, Heart, ImageOff, Tag, Trash2 } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavigation } from "@/components/layout/site-navigation";
import { useLocale } from "@/components/providers/locale-provider";
import { getFavoritesSnapshot, getServerFavoritesSnapshot, productImage, subscribeFavorites, toggleFavoriteProduct } from "@/lib/favorites";
import { languageLocale } from "@/lib/i18n";
import type { CatalogProduct } from "@/lib/types";

export function FavoritesView() {
  const { language, t } = useLocale();
  const products = useSyncExternalStore(subscribeFavorites, getFavoritesSnapshot, getServerFavoritesSnapshot);
  const currency = useMemo(() => new Intl.NumberFormat(languageLocale(language), { style: "currency", currency: "USD", maximumFractionDigits: 0 }), [language]);

  function removeFavorite(product: CatalogProduct) {
    toggleFavoriteProduct(product);
  }

  return (
    <main className="catalog-background relative min-h-screen overflow-x-hidden">
      <div className="home-grid pointer-events-none absolute inset-0 opacity-35" aria-hidden="true" />
      <div className="page-orb -right-24 top-24 h-80 w-80 bg-[rgba(208,188,255,0.1)]" aria-hidden="true" />
      <SiteNavigation />
      <div className="relative z-10 mx-auto w-full max-w-[92rem] px-5 pb-20 pt-32 sm:px-8 sm:pt-36 lg:px-12 lg:pt-40">
        <section className="mx-auto max-w-3xl py-8 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--accent)]">{t("favorites.eyebrow")}</p>
          <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="serif text-5xl leading-[0.98] tracking-[-0.04em] sm:text-6xl">{t("favorites.title")}</h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--muted)]">{t("favorites.description")}</p>
            </div>
            <Link className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[var(--line-strong)] px-4 py-2.5 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:self-auto" href="/catalog">
              {t("favorites.exploreCatalog")} <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {products.length ? (
          <section className="mx-auto max-w-3xl" aria-label={t("favorites.title")}>
            <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3 text-xs text-[var(--muted-soft)]">
              <span>{t("favorites.count", { count: products.length })}</span>
              <Heart className="text-[var(--accent)]" size={16} fill="currentColor" />
            </div>
            <div className="space-y-3">
              {products.map((product) => <FavoriteListItem key={product.id} product={product} currency={currency} onRemove={() => removeFavorite(product)} t={t} />)}
            </div>
          </section>
        ) : (
          <section className="mx-auto flex max-w-3xl flex-col items-center rounded-3xl border border-dashed border-[var(--line-strong)] bg-white/[0.025] px-6 py-20 text-center">
            <Heart className="text-[var(--accent)]" size={30} />
            <h2 className="serif mt-5 text-3xl">{t("favorites.emptyTitle")}</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{t("favorites.emptyDescription")}</p>
            <Link className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-[var(--accent)]" href="/catalog">
              {t("favorites.exploreCatalog")} <ArrowRight size={16} />
            </Link>
          </section>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}

function FavoriteListItem({ product, currency, onRemove, t }: { product: CatalogProduct; currency: Intl.NumberFormat; onRemove: () => void; t: ReturnType<typeof useLocale>["t"] }) {
  const image = productImage(product);
  return (
    <article className="group flex gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-lowest)] p-3 transition hover:border-[var(--line-strong)] hover:shadow-[0_18px_42px_rgba(0,0,0,0.25)] sm:gap-5 sm:p-4">
      <div className="relative h-32 w-28 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-high)] sm:h-40 sm:w-36">
        {image ? <Image className="object-cover transition duration-300 group-hover:scale-[1.02]" src={image} alt={product.product_display_name} fill sizes="144px" /> : <div className="flex h-full items-center justify-center text-[var(--muted-soft)]"><ImageOff size={24} /></div>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">{product.brand ?? "Lookeate"}</p>
          <h2 className="serif mt-2 line-clamp-2 text-2xl leading-tight sm:text-3xl">{product.product_display_name}</h2>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{[product.gender, product.usage, product.season, product.year].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[11px] text-[var(--muted-soft)]"><Tag size={13} /> {product.sub_category}</span>
          <div className="flex items-center gap-3">
            {product.price !== null ? <span className="text-sm font-bold">{currency.format(product.price)}</span> : null}
            <button className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted-soft)] transition hover:text-[var(--danger)]" type="button" onClick={onRemove} aria-label={t("favorites.remove", { name: product.product_display_name })}>
              <Trash2 size={13} /> <span className="hidden sm:inline">{t("favorites.removeAction")}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
