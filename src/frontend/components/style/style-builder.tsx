"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Rotate3D,
  RotateCcw,
  Search,
  Shirt,
  Sparkles,
  X,
} from "lucide-react";

import { useLocale } from "@/components/providers/locale-provider";
import type { MessageKey } from "@/lib/i18n";

type GarmentCategory = "top" | "bottom" | "shoes";

type Garment = {
  id: string;
  category: GarmentCategory;
  name: string;
  brand: string;
  color: string;
  colorName: string;
  image: string;
  shape: "shirt" | "tee" | "sweatshirt" | "jacket" | "jeans" | "trousers" | "shorts" | "casual" | "sport";
};

const garments: Garment[] = [
  {
    id: "15970",
    category: "top",
    name: "Turtle Check Shirt",
    brand: "Turtle",
    color: "#233452",
    colorName: "Navy blue",
    image: "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/98d4d8ff4f264ca568ba948a4524c92f_images.jpg",
    shape: "shirt",
  },
  {
    id: "53759",
    category: "top",
    name: "Essential Grey T-shirt",
    brand: "Puma",
    color: "#777878",
    colorName: "Grey",
    image: "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/Puma-Men-Grey-T-shirt_42bb3c514744f090429ae8c6abc99abd_images.jpg",
    shape: "tee",
  },
  {
    id: "13089",
    category: "top",
    name: "LFC Auth Hoodie",
    brand: "Adidas",
    color: "#53575b",
    colorName: "Graphite",
    image: "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/2fb677682f3db4d68d91735fbb248be9_images.jpg",
    shape: "sweatshirt",
  },
  {
    id: "6889",
    category: "top",
    name: "Stone Cream Jacket",
    brand: "Forever New",
    color: "#d0c5af",
    colorName: "Cream",
    image: "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/015d1e76c5b83086a6225a862b80bf31_images.jpg",
    shape: "jacket",
  },
  {
    id: "39386",
    category: "bottom",
    name: "Party Blue Jeans",
    brand: "Peter England",
    color: "#37577b",
    colorName: "Denim blue",
    image: "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/9518118a48a32e2fe37e6332b797849f_images.jpg",
    shape: "jeans",
  },
  {
    id: "10257",
    category: "bottom",
    name: "Solid Black Trousers",
    brand: "John Miller",
    color: "#242526",
    colorName: "Black",
    image: "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/c89dcbbbb1808b968817653e03b8b2b5_images.jpg",
    shape: "trousers",
  },
  {
    id: "18005",
    category: "bottom",
    name: "Long Logo Bermuda",
    brand: "Puma",
    color: "#18191a",
    colorName: "Black",
    image: "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/c2a91e5ecd0c4d503645435fd3089980_images.jpg",
    shape: "shorts",
  },
  {
    id: "9204",
    category: "shoes",
    name: "Future Cat Remix",
    brand: "Puma",
    color: "#1a1b1c",
    colorName: "Black",
    image: "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/fc220b750764a2a093b791eaeb90fed5_images.jpg",
    shape: "casual",
  },
  {
    id: "3168",
    category: "shoes",
    name: "Incinerate MSL",
    brand: "Nike",
    color: "#e7e5df",
    colorName: "White",
    image: "https://assets.myntassets.com/h_1440,q_95,w_1080/v1/images/style/properties/97687ab5c5fb62fa367a5b5875d8835f_images.jpg",
    shape: "sport",
  },
];

const categoryOrder: GarmentCategory[] = ["top", "bottom", "shoes"];
const categoryLabelKeys: Record<GarmentCategory, MessageKey> = {
  top: "style.category.top",
  bottom: "style.category.bottom",
  shoes: "style.category.shoes",
};

export function StyleBuilder() {
  const { t } = useLocale();
  const [activeCategory, setActiveCategory] = useState<GarmentCategory>("top");
  const [query, setQuery] = useState("");
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selected, setSelected] = useState<Partial<Record<GarmentCategory, Garment>>>({});
  const dragStart = useRef<{ x: number; rotation: number } | null>(null);

  const visibleGarments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return garments.filter((garment) =>
      garment.category === activeCategory
      && (!normalizedQuery
        || garment.name.toLowerCase().includes(normalizedQuery)
        || garment.brand.toLowerCase().includes(normalizedQuery)
        || garment.colorName.toLowerCase().includes(normalizedQuery)),
    );
  }, [activeCategory, query]);

  function rotateBy(delta: number) {
    setRotation((current) => Math.max(-65, Math.min(65, current + delta)));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragStart.current = { x: event.clientX, rotation };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) {
      return;
    }
    const nextRotation = dragStart.current.rotation + (event.clientX - dragStart.current.x) * 0.32;
    setRotation(Math.max(-65, Math.min(65, nextRotation)));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragStart.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function toggleGarment(garment: Garment) {
    setSelected((current) => ({
      ...current,
      [garment.category]: current[garment.category]?.id === garment.id ? undefined : garment,
    }));
  }

  return (
    <main className="style-builder-background min-h-screen text-[var(--text)]">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--line)] px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)]"
            href="/"
            aria-label={t("style.backHome")}
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{t("home.styleTitle")}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-[var(--muted-soft)]">
              Lookeate Studio · {t("style.prototype")}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 text-xs text-[var(--muted)] sm:flex">
          <CircleHelp size={15} />
          {t("style.headerHelp")}
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[20rem_minmax(28rem,1fr)_17rem]">
        <aside className="order-2 border-t border-[var(--line)] bg-[rgba(18,18,18,0.86)] lg:order-1 lg:border-r lg:border-t-0">
          <div className="border-b border-[var(--line)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t("style.wardrobe")}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{t("style.wardrobeDescription")}</p>
              </div>
              <Shirt size={18} className="text-[var(--accent)]" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-1 rounded-lg bg-[var(--surface-low)] p-1">
              {categoryOrder.map((category) => (
                <button
                  key={category}
                  className={`rounded-md px-2 py-2 text-xs font-semibold transition ${activeCategory === category ? "bg-[var(--surface-highest)] text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                  type="button"
                  onClick={() => {
                    setActiveCategory(category);
                    setQuery("");
                  }}
                >
                  {t(categoryLabelKeys[category])}
                </button>
              ))}
            </div>

            <label className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-low)] px-3 focus-within:border-[var(--accent)]">
              <Search size={15} className="text-[var(--muted)]" />
              <input
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-[var(--muted-soft)]"
                value={query}
                placeholder={t("style.searchGarments")}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <button
                  className="text-[var(--muted)] hover:text-[var(--text)]"
                  type="button"
                  aria-label={t("common.clear")}
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              ) : null}
            </label>
          </div>

          <div className="scroll-modal grid max-h-[31rem] grid-cols-2 gap-3 overflow-y-auto p-4 lg:max-h-[calc(100vh-14.5rem)] lg:grid-cols-1">
            {visibleGarments.map((garment) => {
              const isSelected = selected[garment.category]?.id === garment.id;
              return (
                <button
                  key={garment.id}
                  className={`group grid min-h-28 grid-cols-[5.5rem_minmax(0,1fr)] overflow-hidden rounded-xl border text-left transition ${isSelected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-white/[0.025] hover:border-[var(--line-strong)] hover:bg-white/[0.05]"}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleGarment(garment)}
                >
                  <span className="relative bg-[#ece9e7]">
                    <Image
                      className="h-full w-full object-cover mix-blend-multiply"
                      src={garment.image}
                      alt={garment.name}
                      width={180}
                      height={220}
                      unoptimized
                    />
                    {isSelected ? (
                      <span className="absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]">
                        <Check size={13} />
                      </span>
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col justify-between p-3">
                    <span>
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-[var(--muted-soft)]">{garment.brand}</span>
                      <span className="mt-1 block text-sm font-semibold leading-5">{garment.name}</span>
                    </span>
                    <span className="mt-3 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                      <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: garment.color }} />
                      {garment.colorName}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="order-1 relative flex min-h-[42rem] flex-col overflow-hidden lg:order-2 lg:min-h-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(255,255,255,0.085),transparent_18rem)]" />
          <div className="relative z-10 flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-soft)]">{t("style.canvas")}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{t("style.dragHint")}</p>
            </div>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
              type="button"
              onClick={() => setRotation(0)}
            >
              <RotateCcw size={14} />
              {t("style.resetView")}
            </button>
          </div>

          <div
            className={`style-mannequin-stage relative flex flex-1 touch-none select-none items-center justify-center ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            role="application"
            aria-label={t("style.mannequinLabel")}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                rotateBy(-10);
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                rotateBy(10);
              }
            }}
          >
            <div className="style-mannequin-shadow" aria-hidden="true" />
            <Mannequin rotation={rotation} selected={selected} />
          </div>

          <div className="relative z-10 flex items-center justify-center gap-3 pb-6">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition hover:text-[var(--text)]"
              type="button"
              aria-label={t("style.rotateLeft")}
              onClick={() => rotateBy(-15)}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="inline-flex min-w-28 items-center justify-center gap-2 text-xs text-[var(--muted)]">
              <Rotate3D size={16} />
              {Math.round(rotation)}°
            </span>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition hover:text-[var(--text)]"
              type="button"
              aria-label={t("style.rotateRight")}
              onClick={() => rotateBy(15)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        <aside className="order-3 border-t border-[var(--line)] bg-[rgba(18,18,18,0.86)] p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold">{t("style.currentLook")}</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t("style.currentLookDescription")}</p>

          <div className="mt-6 space-y-3">
            {categoryOrder.map((category) => {
              const garment = selected[category];
              return (
                <div key={category} className="rounded-xl border border-[var(--line)] bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-soft)]">
                      {t(categoryLabelKeys[category])}
                    </span>
                    {garment ? (
                      <button
                        className="text-[var(--muted)] transition hover:text-[var(--text)]"
                        type="button"
                        aria-label={t("style.removeGarment", { garment: garment.name })}
                        onClick={() => setSelected((current) => ({ ...current, [category]: undefined }))}
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                  {garment ? (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="h-9 w-9 rounded-lg border border-white/15" style={{ backgroundColor: garment.color }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{garment.name}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">{garment.brand}</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="mt-3 w-full rounded-lg border border-dashed border-[var(--line-strong)] px-3 py-3 text-left text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                      type="button"
                      onClick={() => setActiveCategory(category)}
                    >
                      {t("style.chooseGarment")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-soft)]">{t("style.progress")}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-high)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${(Object.values(selected).filter(Boolean).length / categoryOrder.length) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {t("style.piecesSelected", { count: Object.values(selected).filter(Boolean).length, total: categoryOrder.length })}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Mannequin({
  rotation,
  selected,
}: {
  rotation: number;
  selected: Partial<Record<GarmentCategory, Garment>>;
}) {
  const top = selected.top;
  const bottom = selected.bottom;
  const shoes = selected.shoes;

  return (
    <div className="style-mannequin-wrap" style={{ transform: `rotateY(${rotation}deg)` }} aria-hidden="true">
      <div className="style-mannequin-head" />
      <div className="style-mannequin-neck" />
      <div className="style-mannequin-torso" />
      <div className="style-mannequin-arm style-mannequin-arm-left" />
      <div className="style-mannequin-arm style-mannequin-arm-right" />
      <div className="style-mannequin-leg style-mannequin-leg-left" />
      <div className="style-mannequin-leg style-mannequin-leg-right" />

      {top ? (
        <>
          <div className={`style-garment-top style-garment-top-${top.shape}`} style={{ backgroundColor: top.color }} />
          <div className="style-garment-sleeve style-garment-sleeve-left" style={{ backgroundColor: top.color }} />
          <div className="style-garment-sleeve style-garment-sleeve-right" style={{ backgroundColor: top.color }} />
        </>
      ) : null}

      {bottom ? (
        <>
          <div className={`style-garment-waist style-garment-bottom-${bottom.shape}`} style={{ backgroundColor: bottom.color }} />
          <div className={`style-garment-leg style-garment-leg-left style-garment-bottom-${bottom.shape}`} style={{ backgroundColor: bottom.color }} />
          <div className={`style-garment-leg style-garment-leg-right style-garment-bottom-${bottom.shape}`} style={{ backgroundColor: bottom.color }} />
        </>
      ) : null}

      {shoes ? (
        <>
          <div className="style-garment-shoe style-garment-shoe-left" style={{ backgroundColor: shoes.color }} />
          <div className="style-garment-shoe style-garment-shoe-right" style={{ backgroundColor: shoes.color }} />
        </>
      ) : null}
    </div>
  );
}
