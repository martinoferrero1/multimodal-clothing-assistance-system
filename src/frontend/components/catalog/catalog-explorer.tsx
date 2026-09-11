/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Camera, Check, ChevronDown, ChevronRight, Grid2X2, Heart, ImageOff, Layers3, LayoutGrid, LoaderCircle, Rotate3D, Search, Tag, X } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavigation } from "@/components/layout/site-navigation";
import { useLocale } from "@/components/providers/locale-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCatalogMeta, listCatalogProducts, searchCatalogByImage } from "@/lib/api-client";
import { getFavoritesSnapshot, getServerFavoritesSnapshot, subscribeFavorites, toggleFavoriteProduct } from "@/lib/favorites";
import { languageLocale } from "@/lib/i18n";
import type { CatalogMeta, CatalogProduct, CatalogTaxonomy } from "@/lib/types";

type SortOption = "relevance" | "newest" | "priceAsc" | "priceDesc";
const PAGE_SIZE = 12;

function productImage(product: CatalogProduct): string | null {
  return product.images.default || product.images.front || product.images.search || product.images.top || product.images.left || product.images.right || product.images.back;
}

type CategoryPickerProps = {
  buttonClassName: string;
  buttonContent: ReactNode;
  label: string;
  menuClassName?: string;
  onSelect: (masterCategory: string | null, subCategory: string | null) => void;
  selectedMaster: string | null;
  selectedSub: string | null;
  taxonomy: CatalogTaxonomy[];
};

function CategoryPicker({ buttonClassName, buttonContent, label, menuClassName, onSelect, selectedMaster, selectedSub, taxonomy }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeMaster, setActiveMaster] = useState<string | null>(selectedMaster ?? taxonomy[0]?.name ?? null);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeCategory = taxonomy.find((category) => category.name === activeMaster) ?? taxonomy[0];

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, selectedMaster, taxonomy]);

  function choose(masterCategory: string | null, subCategory: string | null) {
    onSelect(masterCategory, subCategory);
    setOpen(false);
  }

  return (
    <div className={`relative ${open ? "z-50" : "z-auto"}`} ref={rootRef}>
      <button className={buttonClassName} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (!open) setActiveMaster(selectedMaster ?? taxonomy[0]?.name ?? null); setOpen((current) => !current); }}>
        {buttonContent}<ChevronDown className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} size={15} />
      </button>
      <section className={`absolute left-0 top-[calc(100%+0.65rem)] origin-top-left overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[#151515] shadow-[0_28px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl transition duration-200 ${menuClassName ?? "w-[min(46rem,calc(100vw-2.5rem))]"} ${open ? "visible translate-y-0 scale-100 opacity-100" : "pointer-events-none invisible -translate-y-1 scale-[0.98] opacity-0"}`} role="dialog" aria-label={label} aria-hidden={!open}>
        <div className="grid max-h-[27rem] grid-cols-[minmax(7.5rem,0.72fr)_minmax(9rem,1.28fr)]">
          <div className="overflow-y-auto border-r border-[var(--line)] bg-black/15 p-2 sm:p-3">
            <button className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition sm:text-sm ${selectedMaster === null ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-white/[0.05] hover:text-[var(--text)]"}`} type="button" onClick={() => choose(null, null)}>
              {label}{selectedMaster === null ? <Check size={15} /> : null}
            </button>
            {taxonomy.map((category) => (
              <button key={category.name} className={`mt-1 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition sm:text-sm ${activeCategory?.name === category.name ? "bg-white/[0.07] text-[var(--text)]" : "text-[var(--muted)] hover:bg-white/[0.05] hover:text-[var(--text)]"} ${selectedMaster === category.name && !selectedSub ? "text-[var(--accent)]" : ""}`} type="button" onMouseEnter={() => setActiveMaster(category.name)} onFocus={() => setActiveMaster(category.name)} onClick={() => choose(category.name, null)}>
                <span>{category.name}</span><ChevronRight className="shrink-0 text-[var(--muted-soft)]" size={14} />
              </button>
            ))}
          </div>
          <div className="overflow-y-auto p-3 sm:p-5">
            {activeCategory ? <><div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3"><p className="text-sm font-semibold sm:text-base">{activeCategory.name}</p>{selectedMaster === activeCategory.name && !selectedSub ? <Check className="text-[var(--accent)]" size={16} /> : null}</div><div className="grid gap-1 sm:grid-cols-2">{activeCategory.subcategories.map((subcategory) => <button key={`${activeCategory.name}-${subcategory.name}`} className={`flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition sm:text-sm ${selectedMaster === activeCategory.name && selectedSub === subcategory.name ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-white/[0.05] hover:text-[var(--text)]"}`} type="button" onClick={() => choose(activeCategory.name, subcategory.name)}>{subcategory.name}{selectedMaster === activeCategory.name && selectedSub === subcategory.name ? <Check className="shrink-0" size={14} /> : null}</button>)}</div></> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function CatalogExplorer() {
  const { language, t } = useLocale();
  const [meta, setMeta] = useState<CatalogMeta>({ taxonomy: [], brands: [] });
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [masterCategory, setMasterCategory] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [articleType, setArticleType] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [tryOnOnly, setTryOnOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("relevance");
  const [brandFilterOpen, setBrandFilterOpen] = useState(false);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [visualSearchFile, setVisualSearchFile] = useState<File | null>(null);
  const [visualSearchPreview, setVisualSearchPreview] = useState<string | null>(null);
  const [visualSearchPending, setVisualSearchPending] = useState(false);
  const requestId = useRef(0);
  const visualSearchInputRef = useRef<HTMLInputElement>(null);
  const visualSearchMode = visualSearchFile !== null;

  const favoriteProducts = useSyncExternalStore(subscribeFavorites, getFavoritesSnapshot, getServerFavoritesSnapshot);
  const favoriteIds = useMemo(() => favoriteProducts.map((product) => product.id), [favoriteProducts]);

  const currency = useMemo(() => new Intl.NumberFormat(languageLocale(language), { style: "currency", currency: "USD", maximumFractionDigits: 0 }), [language]);
  const selectedSubcategory = useMemo(() => meta.taxonomy.find((category) => category.name === masterCategory)?.subcategories.find((subcategory) => subcategory.name === subCategory), [masterCategory, meta.taxonomy, subCategory]);
  const articleTypes = selectedSubcategory?.article_types ?? [];
  const categoryLabel = subCategory ? `${masterCategory} / ${subCategory}` : masterCategory ?? t("catalog.allCategories");
  const selectedSortLabel = t(`catalog.sort${sort.charAt(0).toUpperCase()}${sort.slice(1)}` as "catalog.sortRelevance" | "catalog.sortNewest" | "catalog.sortPriceAsc" | "catalog.sortPriceDesc");

  useEffect(() => {
    let active = true;
    getCatalogMeta().then((response) => { if (active) setMeta(response); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retryKey]);

  useEffect(() => {
    if (visualSearchMode) return;
    const currentRequest = ++requestId.current;
    void Promise.resolve().then(() => {
      if (requestId.current === currentRequest) { setLoading(true); setError(false); }
    });
    listCatalogProducts({ query, masterCategory: masterCategory ?? undefined, subCategory: subCategory ?? undefined, articleType: articleType ?? undefined, brand: brand ?? undefined, tryOnOnly, sort, offset: 0, limit: PAGE_SIZE })
      .then((response) => {
        if (requestId.current !== currentRequest) return;
        setProducts(response.items); setTotal(response.total); setHasMore(response.has_more);
      })
      .catch(() => { if (requestId.current === currentRequest) setError(true); })
      .finally(() => { if (requestId.current === currentRequest) setLoading(false); });
  }, [articleType, brand, masterCategory, query, retryKey, sort, subCategory, tryOnOnly, visualSearchMode]);

  useEffect(() => () => {
    if (visualSearchPreview) URL.revokeObjectURL(visualSearchPreview);
  }, [visualSearchPreview]);

  useEffect(() => {
    if (!filtersDrawerOpen && !selectedProduct) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { setFiltersDrawerOpen(false); setSelectedProduct(null); }
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", closeOnEscape); };
  }, [filtersDrawerOpen, selectedProduct]);

  function selectCategory(nextMaster: string | null, nextSub: string | null) {
    setMasterCategory(nextMaster); setSubCategory(nextSub); setArticleType(null); setBrandFilterOpen(false);
  }
  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!visualSearchMode) setQuery(draftQuery.trim()); }
  function applySuggestion(value: string) { setDraftQuery(value); setQuery(value); }
  function resetFilters() { setDraftQuery(""); setQuery(""); selectCategory(null, null); setBrand(null); setTryOnOnly(false); setSort("relevance"); }
  function clearVisualSearch() { requestId.current += 1; setVisualSearchFile(null); setVisualSearchPreview(null); setVisualSearchPending(false); setError(false); }
  async function handleVisualSearchSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image) return;
    const currentRequest = ++requestId.current;
    setVisualSearchFile(image); setVisualSearchPreview(URL.createObjectURL(image)); setVisualSearchPending(true); setLoading(true); setError(false); setFiltersDrawerOpen(false); setBrandFilterOpen(false);
    resetFilters();
    try {
      const response = await searchCatalogByImage([image], 0, PAGE_SIZE);
      if (requestId.current !== currentRequest) return;
      setProducts(response.items); setTotal(response.total); setHasMore(response.has_more);
    } catch {
      if (requestId.current === currentRequest) setError(true);
    } finally {
      if (requestId.current === currentRequest) { setLoading(false); setVisualSearchPending(false); }
    }
  }
  function toggleFavorite(product: CatalogProduct) { toggleFavoriteProduct(product); }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    const currentRequest = requestId.current;
    setLoadingMore(true); setError(false);
    try {
      const response = visualSearchFile
        ? await searchCatalogByImage([visualSearchFile], products.length, PAGE_SIZE)
        : await listCatalogProducts({ query, masterCategory: masterCategory ?? undefined, subCategory: subCategory ?? undefined, articleType: articleType ?? undefined, brand: brand ?? undefined, tryOnOnly, sort, offset: products.length, limit: PAGE_SIZE });
      if (requestId.current !== currentRequest) return;
      setProducts((current) => { const seen = new Set(current.map((product) => product.id)); return [...current, ...response.items.filter((product) => !seen.has(product.id))]; });
      setTotal(response.total); setHasMore(response.has_more);
    } catch { setError(true); } finally { setLoadingMore(false); }
  }

  const categoryButton = <><Layers3 className="shrink-0 text-[var(--accent)]" size={17} /><span className="min-w-0 flex-1 truncate text-left">{categoryLabel}</span></>;
  const categoryPicker = (buttonClassName: string, menuClassName?: string) => <CategoryPicker taxonomy={meta.taxonomy} selectedMaster={masterCategory} selectedSub={subCategory} onSelect={selectCategory} label={t("catalog.allCategories")} menuClassName={menuClassName} buttonClassName={buttonClassName} buttonContent={categoryButton} />;
  const articleTypeSelect = (buttonClassName: string) => <Select value={articleType ?? "all"} valueLabel={articleType ?? t("catalog.allProductTypes")} onValueChange={(value) => setArticleType(value === "all" ? null : value)}><SelectTrigger className={buttonClassName}>{articleType ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> : <Tag size={13} />}<SelectValue placeholder={t("catalog.productType")} /></SelectTrigger><SelectContent className="max-h-72 min-w-56 overflow-y-auto"><SelectItem value="all">{t("catalog.allProductTypes")}</SelectItem>{articleTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>;

  return (
    <main className="catalog-background relative min-h-screen overflow-x-hidden">
      <div className="home-grid pointer-events-none absolute inset-0 opacity-35" aria-hidden="true" /><div className="page-orb -right-24 top-24 h-80 w-80 bg-[rgba(208,188,255,0.1)]" aria-hidden="true" />
      <SiteNavigation />
      <div className="relative z-10 mx-auto w-full max-w-[100rem] px-5 pb-20 pt-32 sm:px-8 sm:pt-36 lg:px-12 lg:pt-40">
        <section className="mx-auto flex max-w-4xl flex-col items-center py-7 text-center sm:py-10" aria-label={t("catalog.searchLabel")}>
          <form className="flex w-full flex-col gap-3 sm:flex-row" onSubmit={submitSearch}><label className={`flex min-h-14 flex-1 items-center gap-3 rounded-full border border-[var(--line-strong)] bg-black/25 px-5 text-left transition focus-within:border-[var(--accent)] ${visualSearchMode ? "opacity-45" : ""}`}><Search size={19} className="shrink-0 text-[var(--accent)]" /><span className="sr-only">{t("catalog.searchLabel")}</span><input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-soft)] sm:text-base" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder={t("catalog.searchPlaceholder")} type="search" disabled={visualSearchMode} /></label><button className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-bold text-[#111] transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45" type="submit" disabled={visualSearchMode}>{t("catalog.searchAction")} <ArrowRight size={16} /></button><input ref={visualSearchInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void handleVisualSearchSelection(event)} /><button className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--surface-low)] px-6 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-wait disabled:opacity-65" type="button" disabled={visualSearchPending} onClick={() => visualSearchInputRef.current?.click()}>{visualSearchPending ? <LoaderCircle className="animate-spin" size={16} /> : <Camera size={16} />}{t("catalog.searchByPhoto")}</button></form>
          {visualSearchMode ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[rgba(208,188,255,0.45)] bg-[var(--accent-soft)] px-3 py-2 text-left"><img className="h-10 w-10 rounded-xl object-cover" src={visualSearchPreview ?? ""} alt="" /><p className="min-w-0 flex-1 text-xs leading-5 text-[var(--accent)]">{t("catalog.visualSearchActive")}</p><button className="rounded-full border border-[rgba(208,188,255,0.5)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]" type="button" onClick={clearVisualSearch}>{t("catalog.clearPhotoSearch")}</button></div> : <div className="mt-4 flex flex-wrap items-center justify-center gap-2"><span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-soft)]">{t("catalog.suggestions")}</span>{[t("catalog.suggestion.architectural"), t("catalog.suggestion.black"), t("catalog.suggestion.tailoring"), t("catalog.suggestion.fluid")].map((suggestion) => <button key={suggestion} className="rounded-full border border-[var(--line)] bg-transparent px-3 py-1.5 text-[11px] text-[var(--muted)] transition hover:border-[rgba(208,188,255,0.5)] hover:text-[var(--text)]" type="button" onClick={() => applySuggestion(suggestion)}># {suggestion}</button>)}</div>}
        </section>

        <section className="mt-6" aria-label={t("catalog.resultsRegion")}>
          <div className="relative z-20 rounded-2xl border border-[var(--line)] bg-[rgba(14,14,14,0.78)] p-3 backdrop-blur-xl sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className={`flex flex-wrap items-center gap-2 ${visualSearchMode ? "pointer-events-none opacity-45" : ""}`} inert={visualSearchMode} aria-disabled={visualSearchMode}>
                <button className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3.5 py-2 text-[11px] font-semibold ${filtersDrawerOpen ? "border-[rgba(208,188,255,0.52)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface-low)]"}`} type="button" disabled={visualSearchMode} onClick={() => setFiltersDrawerOpen(true)}>{t("catalog.filters")} <ChevronRight size={14} /></button>
                {subCategory ? articleTypeSelect("inline-flex min-h-9 min-w-44 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-low)] px-3.5 py-2 text-[11px] font-medium text-[var(--muted)] outline-none hover:border-[var(--line-strong)] hover:text-[var(--text)]") : categoryPicker("inline-flex min-h-9 max-w-64 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-low)] px-3.5 py-2 text-[11px] font-medium text-[var(--muted)] outline-none hover:border-[var(--line-strong)] hover:text-[var(--text)]")}
                <button className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3.5 py-2 text-[11px] font-medium ${brandFilterOpen ? "border-[rgba(208,188,255,0.52)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface-low)] text-[var(--muted)]"}`} type="button" aria-expanded={brandFilterOpen} onClick={() => setBrandFilterOpen((current) => !current)}>{brand ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> : null}{brand ?? t("catalog.brand")} <ChevronDown className={`transition-transform ${brandFilterOpen ? "rotate-180" : ""}`} size={14} /></button>
                <label className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-[11px] font-medium ${tryOnOnly ? "border-[rgba(208,188,255,0.48)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface-low)] text-[var(--muted)]"}`}><input className="h-3.5 w-3.5 accent-[#d0bcff]" type="checkbox" checked={tryOnOnly} onChange={(event) => setTryOnOnly(event.target.checked)} /><Rotate3D size={14} /> {t("catalog.tryOnOnly")}</label>
                {(query || masterCategory || brand || tryOnOnly) ? <button className="px-2 py-2 text-[11px] text-[var(--muted)] underline underline-offset-4" type="button" onClick={resetFilters}>{t("catalog.reset")}</button> : null}
              </div>
              <div className="flex items-center gap-3"><div className={visualSearchMode ? "pointer-events-none opacity-45" : ""} inert={visualSearchMode} aria-disabled={visualSearchMode}><Select value={sort} valueLabel={selectedSortLabel} onValueChange={(value) => setSort(value as SortOption)}><SelectTrigger className="inline-flex min-h-9 min-w-40 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-low)] px-3 text-[11px] text-[var(--muted)] outline-none"><SelectValue placeholder={t("catalog.sortRelevance")} /></SelectTrigger><SelectContent className="right-0 left-auto min-w-48"><SelectItem value="relevance">{t("catalog.sortRelevance")}</SelectItem><SelectItem value="newest">{t("catalog.sortNewest")}</SelectItem><SelectItem value="priceAsc">{t("catalog.sortPriceAsc")}</SelectItem><SelectItem value="priceDesc">{t("catalog.sortPriceDesc")}</SelectItem></SelectContent></Select></div><div className="flex rounded-lg border border-[var(--line)] p-1" aria-label={t("catalog.view")}><button className={`rounded-md p-2 ${!compact ? "bg-[var(--surface-high)]" : "text-[var(--muted-soft)]"}`} type="button" aria-label={t("catalog.viewComfortable")} aria-pressed={!compact} onClick={() => setCompact(false)}><LayoutGrid size={15} /></button><button className={`rounded-md p-2 ${compact ? "bg-[var(--surface-high)]" : "text-[var(--muted-soft)]"}`} type="button" aria-label={t("catalog.viewCompact")} aria-pressed={compact} onClick={() => setCompact(true)}><Grid2X2 size={15} /></button></div></div>
            </div>
            {brandFilterOpen ? <div className="mt-3 border-t border-[var(--line)] pt-4"><div className="max-h-56 overflow-y-auto pr-1"><div className="flex flex-wrap gap-2"><button className={`rounded-full border px-4 py-2 text-[11px] ${brand === null ? "border-[rgba(208,188,255,0.55)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)]"}`} type="button" onClick={() => setBrand(null)}>{brand === null ? <Check className="mr-1 inline" size={13} /> : null}{t("catalog.allBrands")}</button>{meta.brands.map((item) => <button key={item} className={`rounded-full border px-4 py-2 text-[11px] ${brand === item ? "border-[rgba(208,188,255,0.55)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"}`} type="button" onClick={() => setBrand(item)}>{brand === item ? <Check className="mr-1 inline" size={13} /> : null}{item}</button>)}</div></div></div> : null}
          </div>

          <div className="mt-3 flex min-h-5 items-center px-1"><span className="text-[11px] tabular-nums text-[var(--muted-soft)]">{loading ? t("catalog.loading") : t("catalog.resultCount", { count: total })}</span></div>
          {error && !products.length ? <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-white/[0.02] px-6 text-center"><ImageOff className="text-[var(--accent)]" size={24} /><h2 className="serif mt-4 text-2xl">{t("catalog.loadError")}</h2><button className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black" type="button" onClick={() => setRetryKey((current) => current + 1)}>{t("catalog.retry")}</button></div> : loading ? <div className={`mt-3 grid gap-5 ${compact ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"}`} aria-label={t("catalog.loading")}>{Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl border border-[var(--line)] bg-white/[0.035]" />)}</div> : products.length ? <div className={`mt-3 grid gap-5 ${compact ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"}`}>{products.map((product) => <ProductCard key={product.id} product={product} compact={compact} currency={currency} favorite={favoriteIds.includes(product.id)} onFavorite={() => toggleFavorite(product)} onOpen={() => setSelectedProduct(product)} t={t} />)}</div> : <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-white/[0.02] px-6 text-center"><Search className="text-[var(--accent)]" size={22} /><h2 className="serif mt-5 text-2xl">{t("catalog.emptyTitle")}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{t("catalog.emptyDescription")}</p><button className="mt-5 rounded-full border border-[var(--line-strong)] px-5 py-2.5 text-sm font-semibold" type="button" onClick={resetFilters}>{t("catalog.reset")}</button></div>}
          {products.length && hasMore ? <div className="mt-10 flex justify-center border-t border-[var(--line)] pt-10"><button className="inline-flex items-center gap-3 rounded-full border border-[var(--line-strong)] bg-[var(--surface-low)] px-7 py-3.5 text-sm font-bold disabled:opacity-60" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? t("catalog.loadingMore") : t("catalog.loadMore")} <ChevronDown size={14} /></button></div> : null}
        </section>
      </div>

      <div className={`fixed inset-0 z-[90] transition-[visibility] ${filtersDrawerOpen ? "visible" : "invisible delay-300"}`} aria-hidden={!filtersDrawerOpen}><button className={`absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-300 ${filtersDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} type="button" tabIndex={filtersDrawerOpen ? 0 : -1} aria-label={t("common.close")} onClick={() => setFiltersDrawerOpen(false)} /><aside className={`absolute inset-y-0 left-0 flex w-[min(90vw,25rem)] flex-col border-r border-[var(--line-strong)] bg-[#111] shadow-[24px_0_70px_rgba(0,0,0,0.55)] transition-transform duration-300 ${filtersDrawerOpen ? "translate-x-0" : "-translate-x-full"}`} role="dialog" aria-modal="true" inert={!filtersDrawerOpen}><header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Lookeate</p><h2 className="serif mt-1 text-2xl">{t("catalog.filters")}</h2></div><button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)]" type="button" aria-label={t("common.close")} onClick={() => setFiltersDrawerOpen(false)}><X size={17} /></button></header><div className="min-h-0 flex-1 overflow-y-auto px-6 py-2"><section className="border-b border-[var(--line)] py-6"><h3 className="mb-3 text-xs font-semibold">{t("catalog.category")}</h3>{categoryPicker("flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-low)] px-3 text-sm text-[var(--muted)]", "w-full")}{subCategory ? <div className="mt-3">{articleTypeSelect("flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-low)] px-3 text-sm text-[var(--muted)]")}</div> : null}</section><section className="border-b border-[var(--line)] py-6"><h3 className="mb-3 text-xs font-semibold">{t("catalog.brand")}</h3><div className="max-h-60 space-y-1 overflow-y-auto"><button className={`flex w-full justify-between rounded-lg px-3 py-2.5 text-sm ${brand === null ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)]"}`} type="button" onClick={() => setBrand(null)}>{t("catalog.allBrands")}{brand === null ? <Check size={15} /> : null}</button>{meta.brands.map((item) => <button key={item} className={`flex w-full justify-between rounded-lg px-3 py-2.5 text-left text-sm ${brand === item ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)]"}`} type="button" onClick={() => setBrand(item)}>{item}{brand === item ? <Check size={15} /> : null}</button>)}</div></section><section className="py-6"><label className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-3 text-sm ${tryOnOnly ? "border-[rgba(208,188,255,0.45)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)]"}`}><span className="inline-flex items-center gap-2.5"><Rotate3D size={16} /> {t("catalog.tryOnOnly")}</span><input className="h-4 w-4 accent-[#d0bcff]" type="checkbox" checked={tryOnOnly} onChange={(event) => setTryOnOnly(event.target.checked)} /></label></section></div><footer className="border-t border-[var(--line)] bg-black/20 px-6 py-5"><p className="mb-3 text-[11px] text-[var(--muted-soft)]">{t("catalog.resultCount", { count: total })}</p><div className="flex gap-3"><button className="min-h-11 flex-1 rounded-full border border-[var(--line-strong)] px-4 text-xs font-semibold text-[var(--muted)]" type="button" onClick={resetFilters}>{t("catalog.reset")}</button><button className="min-h-11 flex-1 rounded-full bg-white px-4 text-xs font-bold text-black" type="button" onClick={() => setFiltersDrawerOpen(false)}>{t("catalog.viewResults")}</button></div></footer></aside></div>
      <SiteFooter />
      {selectedProduct ? <ProductModal product={selectedProduct} currency={currency} favorite={favoriteIds.includes(selectedProduct.id)} onClose={() => setSelectedProduct(null)} onFavorite={() => toggleFavorite(selectedProduct)} t={t} /> : null}
    </main>
  );
}

type Translation = ReturnType<typeof useLocale>["t"];

function ProductCard({ product, compact, currency, favorite, onFavorite, onOpen, t }: { product: CatalogProduct; compact: boolean; currency: Intl.NumberFormat; favorite: boolean; onFavorite: () => void; onOpen: () => void; t: Translation }) {
  const image = productImage(product);
  return <article className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-lowest)] transition-shadow duration-300 hover:shadow-[0_22px_52px_rgba(0,0,0,0.42)]"><div className={`relative isolate overflow-hidden bg-[var(--surface-high)] ${compact ? "aspect-[4/5]" : "aspect-[3/4]"}`}>{image ? <Image className="origin-center object-cover transition-transform duration-300 ease-in-out will-change-transform group-hover:scale-[1.015]" src={image} alt={product.product_display_name} fill sizes={compact ? "(max-width: 640px) 100vw, 20vw" : "(max-width: 640px) 100vw, 25vw"} /> : <div className="flex h-full items-center justify-center text-[var(--muted-soft)]"><ImageOff size={28} /></div>}<div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3">{product.has_try_on ? <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--accent)] backdrop-blur-md"><Rotate3D size={12} /> {t("catalog.tryOn")}</span> : <span />}<button className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/65 backdrop-blur-md ${favorite ? "text-[var(--accent)]" : "text-white"}`} type="button" aria-label={favorite ? t("catalog.removeFavorite") : t("catalog.addFavorite")} aria-pressed={favorite} onClick={onFavorite}><Heart size={15} fill={favorite ? "currentColor" : "none"} /></button></div><button className="absolute inset-0 flex items-end border-0 bg-gradient-to-t from-black/70 via-transparent to-transparent p-4 text-left opacity-0 outline-none transition group-hover:opacity-100 focus-visible:opacity-100" type="button" onClick={onOpen} aria-label={`${t("catalog.explore")} ${product.product_display_name}`}><span className="inline-flex items-center gap-2 text-xs font-bold text-white">{t("catalog.quickView")} <ArrowRight size={14} /></span></button></div><button className="block w-full p-4 text-left" type="button" onClick={onOpen}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted-soft)]">{product.brand ?? "Lookeate"}</p><h2 className="serif mt-2 line-clamp-2 text-xl leading-tight transition group-hover:text-[var(--accent)]">{product.product_display_name}</h2></div>{product.price !== null ? <span className="shrink-0 text-sm font-bold tabular-nums">{currency.format(product.price)}</span> : null}</div><p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{[product.article_type, product.usage, product.season, product.year].filter(Boolean).join(" · ")}</p><div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-[11px] text-[var(--muted-soft)]"><span className="inline-flex min-w-0 items-center gap-1.5 truncate"><Tag size={13} /> {product.sub_category}</span><span>{t("catalog.explore")} →</span></div></button></article>;
}

function ProductModal({ product, currency, favorite, onClose, onFavorite, t }: { product: CatalogProduct; currency: Intl.NumberFormat; favorite: boolean; onClose: () => void; onFavorite: () => void; t: Translation }) {
  const image = productImage(product);
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-shell floating-shadow relative grid max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[1.75rem] sm:grid-cols-[minmax(0,0.9fr)_minmax(20rem,1.1fr)] sm:overflow-hidden sm:rounded-[1.75rem]" role="dialog" aria-modal="true" aria-labelledby="catalog-product-title"><button className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white" type="button" onClick={onClose} aria-label={t("common.close")}><X size={18} /></button><div className="relative min-h-80 bg-[var(--surface-high)] sm:min-h-[36rem]">{image ? <Image className="object-cover" src={image} alt={product.product_display_name} fill sizes="(max-width: 640px) 100vw, 45vw" /> : <div className="flex h-full min-h-80 items-center justify-center text-[var(--muted-soft)]"><ImageOff size={34} /></div>}</div><div className="flex flex-col justify-center p-6 sm:p-9"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">{product.brand ?? "Lookeate"} · {product.article_type}</p><h2 id="catalog-product-title" className="serif mt-4 text-4xl leading-[1.04] tracking-[-0.03em]">{product.product_display_name}</h2><p className="mt-5 text-sm leading-7 text-[var(--muted)]">{[product.gender, product.usage, product.season, product.year].filter(Boolean).join(" · ")}</p><div className="mt-7 grid grid-cols-2 gap-3 border-y border-[var(--line)] py-5 text-xs text-[var(--muted)]"><span className="inline-flex items-center gap-2"><Tag size={15} className="text-[var(--accent)]" /> {product.master_category} / {product.sub_category}</span>{product.price !== null ? <span className="text-right font-bold text-[var(--text)]">{currency.format(product.price)}</span> : null}{product.has_try_on ? <span className="col-span-2 inline-flex items-center gap-2 text-[var(--accent)]"><Check size={14} /> {t("catalog.tryOnAvailable")}</span> : null}</div><div className="mt-7 flex gap-3"><Link className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-bold text-black hover:bg-[var(--accent)]" href="/style">{t("catalog.addToLook")} <ArrowRight size={16} /></Link><button className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line-strong)] ${favorite ? "text-[var(--accent)]" : ""}`} type="button" onClick={onFavorite} aria-label={favorite ? t("catalog.removeFavorite") : t("catalog.addFavorite")}><Heart size={17} fill={favorite ? "currentColor" : "none"} /></button></div><p className="mt-4 text-[11px] text-[var(--muted-soft)]">{t("catalog.catalogNote")}</p></div></section></div>;
}
