"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileJson, ImagePlus, PackagePlus, Plus, Upload } from "lucide-react";

import { createStoreInventoryItem, importStoreInventory, listStoreInventory } from "@/lib/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import type { StoreInventoryItem, StoreInventoryItemWrite } from "@/lib/types";

const emptyItem: StoreInventoryItemWrite = { external_id: "", product_display_name: "", details: {} };

const textFields: Array<[keyof StoreInventoryItemWrite, string]> = [
  ["external_id", "External ID / SKU"], ["product_display_name", "Display name"], ["brand", "Brand"],
  ["gender", "Gender"], ["master_category", "Master category"], ["sub_category", "Subcategory"],
  ["article_type", "Article type"], ["base_colour", "Base color"], ["colour1", "Color 1"],
  ["colour2", "Color 2"], ["season", "Season"], ["usage", "Usage"],
];
const imageFields: Array<[keyof StoreInventoryItemWrite, string]> = [
  ["image_default", "Default image URL"], ["image_front", "Front image URL"], ["image_back", "Back image URL"],
  ["image_left", "Left image URL"], ["image_right", "Right image URL"], ["image_top", "Top image URL"],
  ["image_search", "Search image URL"],
];

function compactItem(item: StoreInventoryItemWrite): StoreInventoryItemWrite {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== "" && value !== null && value !== undefined)) as StoreInventoryItemWrite;
}

export function StoreInventoryManager() {
  const auth = useAuth();
  const { t } = useLocale();
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [draft, setDraft] = useState<StoreInventoryItemWrite>(emptyItem);
  const [detailsText, setDetailsText] = useState("{}");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = auth.selectedStore?.status === "active";

  useEffect(() => {
    if (!canManage) return;
    void listStoreInventory().then(setItems).catch(() => setError(t("inventory.loadError"))).finally(() => setLoading(false));
  }, [canManage, t]);

  function updateField(field: keyof StoreInventoryItemWrite, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const imported = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && "items" in parsed ? (parsed as { items: unknown }).items : null;
      if (!Array.isArray(imported)) throw new Error("Invalid inventory JSON");
      const result = await importStoreInventory(imported as StoreInventoryItemWrite[]);
      setNotice(t("inventory.imported", { created: result.created_count, updated: result.updated_count }));
      setItems(await listStoreInventory());
    } catch { setError(t("inventory.importError")); }
    finally { setBusy(false); }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const details = JSON.parse(detailsText) as Record<string, unknown>;
      const created = await createStoreInventoryItem({ ...compactItem(draft), price: draft.price ? Number(draft.price) : null, year: draft.year ? Number(draft.year) : null, details });
      setItems((current) => [created, ...current]); setDraft(emptyItem); setDetailsText("{}"); setShowForm(false);
    } catch { setError(t("inventory.saveError")); }
    finally { setBusy(false); }
  }

  if (!canManage) return <main className="flex min-h-full items-center justify-center p-6"><div className="glass soft-shadow max-w-md rounded-[2rem] p-8 text-center text-sm leading-6 text-[var(--muted)]">{t("inventory.accessDenied")}</div></main>;

  return <main className="home-background min-h-screen px-5 py-8 sm:px-8 lg:px-12"><div className="mx-auto max-w-7xl">
    <header className="mb-8 flex items-center justify-between border-b border-[var(--line)] pb-5 sm:pb-6">
      <Link className="serif text-3xl leading-none text-[var(--text)] transition hover:opacity-80" href="/">
        Lookeate
      </Link>
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]" href="/">
        <ArrowLeft size={16} />
        {t("store.backHome")}
      </Link>
    </header>
    <section className="glass soft-shadow overflow-hidden rounded-[2rem] border border-[var(--line)] p-6 sm:p-9">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">{t("inventory.eyebrow")}</p>
      <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-2xl"><h1 className="serif text-4xl leading-none tracking-[-0.04em] text-[var(--text)] sm:text-5xl">{t("inventory.title")}</h1><p className="mt-4 text-sm leading-6 text-[var(--muted)] sm:text-base">{t("inventory.description")}</p></div><button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#111] transition hover:bg-zinc-200"><Plus size={16}/>{t("inventory.add")}</button></div>
    </section>
    <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="glass rounded-2xl border border-[var(--line)] p-5"><div className="flex items-start gap-3"><span className="mt-0.5 rounded-xl bg-[var(--accent-soft)] p-2 text-[var(--accent)]"><FileJson size={18}/></span><div><h2 className="font-semibold text-[var(--text)]">{t("inventory.import")}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t("inventory.importHint")}</p></div></div><label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-high)]"><Upload size={15}/>{busy ? t("inventory.importing") : t("inventory.chooseFile")}<input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={(event) => void handleImport(event)}/></label></div><div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{auth.selectedStore?.display_name}</p><p className="serif mt-2 text-4xl text-[var(--text)]">{items.length}</p><p className="mt-1 text-sm text-[var(--muted)]">{t("inventory.items", { count: items.length })}</p></div></section>
    {error ? <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}{notice ? <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p> : null}
    {showForm ? <form onSubmit={(event) => void handleSave(event)} className="glass mt-6 rounded-2xl border border-[var(--line)] p-5 sm:p-7"><div className="flex items-start gap-3"><ImagePlus className="mt-1 text-[var(--accent)]" size={19}/><div><h2 className="text-lg font-semibold text-[var(--text)]">{t("inventory.add")}</h2><p className="mt-1 text-sm text-[var(--muted)]">{t("inventory.addDescription")}</p></div></div><div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{textFields.map(([field,label]) => <label key={field} className="text-xs font-medium text-[var(--muted)]">{label}<input required={field === "external_id" || field === "product_display_name"} value={String(draft[field] ?? "")} onChange={(event) => updateField(field, event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"/></label>)}<label className="text-xs font-medium text-[var(--muted)]">Price<input type="number" min="0" step="0.01" value={draft.price ?? ""} onChange={(event) => setDraft((current) => ({...current, price: event.target.value ? Number(event.target.value) : null}))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"/></label><label className="text-xs font-medium text-[var(--muted)]">Year<input type="number" min="1900" max="2100" value={draft.year ?? ""} onChange={(event) => setDraft((current) => ({...current, year: event.target.value ? Number(event.target.value) : null}))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"/></label></div><label className="mt-4 block text-xs font-medium text-[var(--muted)]">Description<textarea value={draft.description ?? ""} onChange={(event) => updateField("description", event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"/></label><label className="mt-4 block text-xs font-medium text-[var(--muted)]">Additional details (JSON)<textarea value={detailsText} onChange={(event) => setDetailsText(event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 font-mono text-xs text-[var(--text)] outline-none transition focus:border-[var(--accent)]"/></label><div className="mt-6 border-t border-[var(--line)] pt-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Image angles</p><div className="mt-3 grid gap-4 md:grid-cols-2">{imageFields.map(([field,label]) => <label key={field} className="text-xs font-medium text-[var(--muted)]">{label}<input type="url" value={String(draft[field] ?? "")} onChange={(event) => updateField(field, event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"/></label>)}</div></div><div className="mt-6 flex justify-end"><button disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#111] disabled:opacity-60"><PackagePlus size={16}/>{busy ? t("inventory.saving") : t("inventory.save")}</button></div></form> : null}
    <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold text-[var(--text)]">{t("inventory.items", { count: items.length })}</h2></div>{loading ? <p className="text-sm text-[var(--muted)]">Loading...</p> : items.length === 0 ? <div className="glass rounded-2xl border border-dashed border-[var(--line-strong)] p-8 text-sm text-[var(--muted)]">{t("inventory.noItems")}</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => { const image = item.image_default || item.image_front || item.image_search; return <article key={item.id} className="glass overflow-hidden rounded-2xl border border-[var(--line)]"><div className="flex aspect-[4/3] items-center justify-center bg-[var(--surface-high)]">{image ? <img src={image} alt={item.product_display_name} className="h-full w-full object-cover"/> : <ImagePlus className="text-[var(--muted-soft)]" size={28}/>}</div><div className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">{item.external_id}</p><h3 className="mt-1 line-clamp-1 font-semibold text-[var(--text)]">{item.product_display_name}</h3><p className="mt-2 line-clamp-1 text-sm text-[var(--muted)]">{[item.brand, item.article_type, item.base_colour].filter(Boolean).join(" · ") || "—"}</p></div></article>; })}</div>}</section>
  </div></main>;
}
