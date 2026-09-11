"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ChevronDown, Heart, ImageOff, LogOut, Settings } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { getFavoritesSnapshot, getServerFavoritesSnapshot, productImage, subscribeFavorites } from "@/lib/favorites";
import { languageLocale } from "@/lib/i18n";
import type { CatalogProduct } from "@/lib/types";

export function SiteNavigation() {
  const auth = useAuth();
  const { language, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [favoriteMenuOpen, setFavoriteMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const userActionsRef = useRef<HTMLDivElement | null>(null);
  const displayName = auth.user?.display_name?.trim() || t("common.account");
  const accountInitial = displayName.slice(0, 1).toLocaleUpperCase();
  const currency = new Intl.NumberFormat(languageLocale(language), { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const favoriteProducts = useSyncExternalStore(subscribeFavorites, getFavoritesSnapshot, getServerFavoritesSnapshot);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 12);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!accountMenuOpen && !favoriteMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!userActionsRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
        setFavoriteMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        setFavoriteMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen, favoriteMenuOpen]);

  async function handleSignOut() {
    setAccountMenuOpen(false);
    await auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <header
        className={`glass hairline fixed left-1/2 z-50 flex -translate-x-1/2 items-center justify-between rounded-2xl transition-[top,width,max-width,padding,box-shadow,background-color,border-color] duration-300 ease-out ${
          isScrolled
            ? "top-6 w-[calc(100%-3rem)] max-w-[100rem] px-3 py-3.5 shadow-[0_12px_35px_rgba(0,0,0,0.24)] sm:px-5 sm:py-4"
            : "top-4 w-[calc(100%-2rem)] max-w-[112rem] px-4 py-4 sm:px-6 sm:py-5"
        }`}
      >
        <div className="flex items-center gap-4">
          <Link className="serif text-3xl leading-none text-[var(--text)] transition hover:opacity-80 sm:text-[2.15rem]" href="/">
            Lookeate
          </Link>
          <span className="hidden rounded-full border border-[var(--line-strong)] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)] sm:inline">
            {t("common.beta")}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-6">
          <nav className="hidden flex-1 items-center justify-center gap-4 text-xs text-[var(--muted)] md:flex lg:gap-6 xl:text-sm" aria-label={t("home.primaryNavigation")}>
            <Link className={`transition hover:text-[var(--text)] ${pathname === "/" ? "font-semibold text-[var(--text)]" : ""}`} href="/">{t("sidebar.home")}</Link>
            <Link className={`transition hover:text-[var(--text)] ${pathname.startsWith("/chat") ? "font-semibold text-[var(--text)]" : ""}`} href="/chat/new">{t("sidebar.assistant")}</Link>
            <Link className={`transition hover:text-[var(--text)] ${pathname.startsWith("/style") ? "font-semibold text-[var(--text)]" : ""}`} href="/style">{t("home.styleTitle")}</Link>
            <Link className={`transition hover:text-[var(--text)] ${pathname.startsWith("/catalog") ? "font-semibold text-[var(--text)]" : ""}`} href="/catalog">{t("home.catalogTitle")}</Link>
            <Link className={`transition hover:text-[var(--text)] ${pathname.startsWith("/news") ? "font-semibold text-[var(--text)]" : ""}`} href="/news">{t("news.navLabel")}</Link>
            <button className="cursor-not-allowed text-left text-[var(--muted-soft)] opacity-55" type="button" disabled aria-disabled="true" title={t("common.comingSoon")}>{t("home.garmentTitle")}</button>
          </nav>

          <div className="flex shrink-0 items-center gap-2" ref={userActionsRef}>
            <div className="relative">
              <button
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white/[0.035] p-1.5 pr-2.5 text-sm text-[var(--text)] transition hover:border-[var(--line-strong)] hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:pr-4"
              type="button"
              aria-label={t("home.openAccountMenu")}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              onClick={() => {
                setAccountMenuOpen((open) => !open);
                setFavoriteMenuOpen(false);
              }}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--text)] text-xs font-bold text-[var(--bg-strong)]">
                {accountInitial}
              </span>
              <span className="hidden max-w-32 truncate sm:inline">{displayName}</span>
              <ChevronDown size={14} className={`transition ${accountMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {accountMenuOpen ? (
                <div className="floating-shadow absolute right-0 top-[calc(100%+0.65rem)] z-40 w-56 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-2" role="menu">
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
                <button className="option-row flex w-full items-center gap-3 px-3 py-3 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-high)]" type="button" role="menuitem" onClick={() => void handleSignOut()}>
                  <LogOut size={16} />
                  {t("sidebar.signOut")}
                </button>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                className={`relative inline-flex h-11 items-center gap-2 rounded-full border px-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:px-4 ${favoriteMenuOpen || pathname.startsWith("/favorites") ? "border-[rgba(208,188,255,0.5)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-white/[0.035] text-[var(--text)] hover:border-[var(--line-strong)] hover:bg-white/[0.07]"}`}
                type="button"
                aria-label={t("favorites.openMenu")}
                aria-haspopup="dialog"
                aria-expanded={favoriteMenuOpen}
                onClick={() => {
                  setFavoriteMenuOpen((open) => !open);
                  setAccountMenuOpen(false);
                }}
              >
                <Heart size={16} fill={favoriteProducts.length ? "currentColor" : "none"} />
                <span className="hidden sm:inline">{t("favorites.title")}</span>
                {favoriteProducts.length ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-ink)]">{favoriteProducts.length}</span> : null}
              </button>

              {favoriteMenuOpen ? (
                <div className="floating-shadow absolute right-0 top-[calc(100%+0.65rem)] z-40 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)]" role="dialog" aria-label={t("favorites.title")}>
                  <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{t("favorites.title")}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted-soft)]">{t("favorites.count", { count: favoriteProducts.length })}</p>
                    </div>
                    <Heart className="text-[var(--accent)]" size={17} fill="currentColor" />
                  </div>

                  {favoriteProducts.length ? (
                    <div className="max-h-[22rem] overflow-y-auto p-2">
                      {favoriteProducts.slice(0, 4).map((product) => <FavoritePreviewItem key={product.id} product={product} currency={currency} />)}
                      {favoriteProducts.length > 4 ? <p className="px-3 pb-2 pt-1 text-center text-[11px] text-[var(--muted-soft)]">{t("favorites.more", { count: favoriteProducts.length - 4 })}</p> : null}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center px-6 py-9 text-center">
                      <Heart className="text-[var(--muted-soft)]" size={24} />
                      <p className="mt-3 text-sm font-semibold text-[var(--text)]">{t("favorites.emptyTitle")}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t("favorites.emptyDescription")}</p>
                    </div>
                  )}

                  <Link className="block border-t border-[var(--line)] bg-white/[0.035] px-4 py-3.5 text-center text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]" href="/favorites" onClick={() => setFavoriteMenuOpen(false)}>
                    {t("favorites.viewAll")}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function FavoritePreviewItem({ product, currency }: { product: CatalogProduct; currency: Intl.NumberFormat }) {
  const image = productImage(product);
  return (
    <Link className="flex gap-3 rounded-xl p-2 transition hover:bg-white/[0.06]" href="/favorites">
      <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-high)]">
        {image ? <Image className="object-cover" src={image} alt="" fill sizes="56px" /> : <div className="flex h-full items-center justify-center text-[var(--muted-soft)]"><ImageOff size={16} /></div>}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted-soft)]">{product.brand ?? "Lookeate"}</p>
        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-[var(--text)]">{product.product_display_name}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
          <span className="truncate">{[product.article_type, product.sub_category].filter(Boolean).join(" · ")}</span>
          {product.price !== null ? <span className="shrink-0 font-bold text-[var(--text)]">{currency.format(product.price)}</span> : null}
        </div>
      </div>
    </Link>
  );
}
