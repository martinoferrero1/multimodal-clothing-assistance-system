"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FileJson, ImagePlus, PackagePlus, Pencil, Plus, Store, Trash2, Upload } from "lucide-react";

import { createStoreInventoryItem, deleteStoreInventoryItem, importStoreInventory, listStoreInventory, updateStoreInventoryItem } from "@/lib/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import type { StoreInventoryItem, StoreInventoryItemWrite } from "@/lib/types";

const emptyItem: StoreInventoryItemWrite = { external_id: "", product_display_name: "", details: {} };
const textFields: Array<[keyof StoreInventoryItemWrite, string]> = [
  ["external_id", "SKU o ID interno"], ["product_display_name", "Nombre del producto"], ["brand", "Marca"], ["gender", "Género"],
  ["master_category", "Categoría principal"], ["sub_category", "Subcategoría"], ["article_type", "Tipo de prenda"], ["base_colour", "Color principal"],
  ["colour1", "Color secundario"], ["colour2", "Otro color"], ["season", "Temporada"], ["usage", "Uso u ocasión"],
];
const imageFields: Array<[keyof StoreInventoryItemWrite, string]> = [
  ["image_default", "Imagen principal"], ["image_front", "Vista frontal"], ["image_back", "Vista posterior"], ["image_left", "Vista izquierda"],
  ["image_right", "Vista derecha"], ["image_top", "Vista superior"], ["image_search", "Imagen para búsquedas"],
];

function compactItem(item: StoreInventoryItemWrite): StoreInventoryItemWrite {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== "" && value !== null && value !== undefined)) as StoreInventoryItemWrite;
}

function writeItemFrom(item: StoreInventoryItem): StoreInventoryItemWrite {
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...writeItem } = item;
  return { ...writeItem, details: writeItem.details ?? {} };
}

export function StoreInventoryManager() {
  const auth = useAuth();
  const router = useRouter();
  const { t } = useLocale();
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [draft, setDraft] = useState<StoreInventoryItemWrite>(emptyItem);
  const [detailsText, setDetailsText] = useState("{}");
  const [editingItem, setEditingItem] = useState<StoreInventoryItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreInventoryItem | null>(null);
  const canManage = auth.selectedStore?.status === "active";

  useEffect(() => {
    if (!canManage) return;
    void listStoreInventory().then(setItems).catch(() => setError(t("inventory.loadError"))).finally(() => setLoading(false));
  }, [canManage, t]);

  function updateField(field: keyof StoreInventoryItemWrite, value: string) { setDraft((current) => ({ ...current, [field]: value })); }
  function resetForm() { setDraft(emptyItem); setDetailsText("{}"); setEditingItem(null); setShowForm(false); }
  function openCreateForm() { setError(null); setNotice(null); setDraft(emptyItem); setDetailsText("{}"); setEditingItem(null); setShowForm(true); }
  function openEditForm(item: StoreInventoryItem) {
    const writeItem = writeItemFrom(item);
    setError(null); setNotice(null); setDraft(writeItem); setDetailsText(JSON.stringify(writeItem.details ?? {}, null, 2)); setEditingItem(item); setShowForm(true);
  }

  async function refreshItems() { setItems(await listStoreInventory()); }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const imported = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && "items" in parsed ? (parsed as { items: unknown }).items : null;
      if (!Array.isArray(imported)) throw new Error("Invalid inventory JSON");
      const result = await importStoreInventory(imported as StoreInventoryItemWrite[]);
      setNotice(t("inventory.imported", { created: result.created_count, updated: result.updated_count }));
      await refreshItems();
    } catch { setError(t("inventory.importError")); } finally { setBusy(false); }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const payload = { ...compactItem(draft), price: draft.price ? Number(draft.price) : null, year: draft.year ? Number(draft.year) : null, details: JSON.parse(detailsText) as Record<string, unknown> };
      const saved = editingItem ? await updateStoreInventoryItem(editingItem.id, payload) : await createStoreInventoryItem(payload);
      setItems((current) => editingItem ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setNotice(editingItem ? t("inventory.updated") : t("inventory.created")); resetForm();
    } catch { setError(editingItem ? t("inventory.updateError") : t("inventory.saveError")); } finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true); setError(null);
    try { await deleteStoreInventoryItem(deleteTarget.id); setItems((current) => current.filter((item) => item.id !== deleteTarget.id)); setNotice(t("inventory.deleted")); setDeleteTarget(null); }
    catch { setError(t("inventory.deleteError")); } finally { setBusy(false); }
  }

  async function handleSignOut() { await auth.signOut(); router.replace("/login"); }

  if (!canManage) return <main className="flex min-h-full items-center justify-center p-6"><div className="glass soft-shadow max-w-md rounded-[2rem] p-8 text-center text-sm leading-6 text-[var(--muted)]">{t("inventory.accessDenied")}</div></main>;

  return <main className="home-background min-h-screen px-5 py-5 sm:px-8 sm:py-7 lg:px-12"><div className="mx-auto max-w-7xl">
    <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5"><div className="flex min-w-0 items-center gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line-strong)] bg-[var(--accent-soft)] text-[var(--accent)]"><Store size={19} /></span><div className="min-w-0"><p className="serif truncate text-2xl leading-none text-[var(--text)]">Lookeate</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{t("inventory.adminArea")}</p></div></div><div className="flex items-center gap-2"><Link className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-high)] hover:text-[var(--text)]" href="/store/community">{t("community.navLabel")}</Link><button className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-high)] hover:text-[var(--text)]" type="button" onClick={() => void handleSignOut()}>{t("sidebar.signOut")}</button></div></header>

    <section className="glass soft-shadow mt-7 overflow-hidden rounded-[2rem] border border-[var(--line)] p-6 sm:p-9"><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">{t("inventory.eyebrow")}</p><div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-2xl"><h1 className="serif text-4xl leading-none tracking-[-0.04em] text-[var(--text)] sm:text-5xl">{t("inventory.title")}</h1><p className="mt-4 text-sm leading-6 text-[var(--muted)] sm:text-base">{t("inventory.description")}</p></div><button type="button" onClick={openCreateForm} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#111] transition hover:bg-zinc-200"><Plus size={16} />{t("inventory.add")}</button></div></section>

    <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="glass rounded-2xl border border-[var(--line)] p-5"><div className="flex items-start gap-3"><span className="mt-0.5 rounded-xl bg-[var(--accent-soft)] p-2 text-[var(--accent)]"><FileJson size={18} /></span><div><h2 className="font-semibold text-[var(--text)]">{t("inventory.import")}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t("inventory.importHint")}</p></div></div><label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-high)]"><Upload size={15} />{busy ? t("inventory.importing") : t("inventory.chooseFile")}<input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={(event) => void handleImport(event)} /></label></div><div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{auth.selectedStore?.display_name}</p><p className="serif mt-2 text-4xl text-[var(--text)]">{items.length}</p><p className="mt-1 text-sm text-[var(--muted)]">{t("inventory.items", { count: items.length })}</p></div></section>
    {error ? <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}{notice ? <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p> : null}

    {showForm ? <form onSubmit={(event) => void handleSave(event)} className="glass mt-6 rounded-2xl border border-[var(--line)] p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><ImagePlus className="mt-1 text-[var(--accent)]" size={19} /><div><h2 className="text-lg font-semibold text-[var(--text)]">{editingItem ? t("inventory.edit") : t("inventory.add")}</h2><p className="mt-1 text-sm text-[var(--muted)]">{t("inventory.addDescription")}</p></div></div><button className="text-sm text-[var(--muted)] transition hover:text-[var(--text)]" type="button" disabled={busy} onClick={resetForm}>{t("common.cancel")}</button></div><div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{textFields.map(([field, label]) => <label key={field} className="text-xs font-medium text-[var(--muted)]">{label}<input required={field === "external_id" || field === "product_display_name"} value={String(draft[field] ?? "")} onChange={(event) => updateField(field, event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]" /></label>)}<label className="text-xs font-medium text-[var(--muted)]">Precio<input type="number" min="0" step="0.01" value={draft.price ?? ""} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value ? Number(event.target.value) : null }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]" /></label><label className="text-xs font-medium text-[var(--muted)]">Año<input type="number" min="1900" max="2100" value={draft.year ?? ""} onChange={(event) => setDraft((current) => ({ ...current, year: event.target.value ? Number(event.target.value) : null }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]" /></label></div><label className="mt-4 block text-xs font-medium text-[var(--muted)]">Descripción<textarea value={draft.description ?? ""} onChange={(event) => updateField("description", event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]" /></label><label className="mt-4 block text-xs font-medium text-[var(--muted)]">Información adicional (opcional)<textarea value={detailsText} onChange={(event) => setDetailsText(event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 font-mono text-xs text-[var(--text)] outline-none transition focus:border-[var(--accent)]" /></label><div className="mt-6 border-t border-[var(--line)] pt-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Imágenes del producto</p><div className="mt-3 grid gap-4 md:grid-cols-2">{imageFields.map(([field, label]) => <label key={field} className="text-xs font-medium text-[var(--muted)]">{label}<input type="url" value={String(draft[field] ?? "")} onChange={(event) => updateField(field, event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]" /></label>)}</div></div><div className="mt-6 flex justify-end"><button disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#111] disabled:opacity-60"><PackagePlus size={16} />{busy ? t("inventory.saving") : editingItem ? t("inventory.saveChanges") : t("inventory.save")}</button></div></form> : null}

    <section className="mt-8"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold text-[var(--text)]">{t("inventory.items", { count: items.length })}</h2></div>{loading ? <p className="text-sm text-[var(--muted)]">Cargando productos...</p> : items.length === 0 ? <div className="glass rounded-2xl border border-dashed border-[var(--line-strong)] p-8 text-sm text-[var(--muted)]">{t("inventory.noItems")}</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => { const image = item.image_default || item.image_front || item.image_search; return <article key={item.id} className="glass overflow-hidden rounded-2xl border border-[var(--line)]"><div className="relative flex aspect-[4/3] items-center justify-center bg-[var(--surface-high)]">{image ? <Image src={image} alt={item.product_display_name} fill unoptimized className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" /> : <ImagePlus className="text-[var(--muted-soft)]" size={28} />}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">{item.external_id}</p><h3 className="mt-1 line-clamp-1 font-semibold text-[var(--text)]">{item.product_display_name}</h3></div><div className="flex shrink-0 gap-1"><button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition hover:text-[var(--text)]" type="button" aria-label={t("inventory.edit")} onClick={() => openEditForm(item)}><Pencil size={14} /></button><button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 text-red-300 transition hover:bg-red-400/10" type="button" aria-label={t("inventory.delete")} onClick={() => setDeleteTarget(item)}><Trash2 size={14} /></button></div></div><p className="mt-2 line-clamp-1 text-sm text-[var(--muted)]">{[item.brand, item.article_type, item.base_colour].filter(Boolean).join(" · ") || "—"}</p></div></article>; })}</div>}</section>
  </div>{deleteTarget ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"><div className="modal-shell w-full max-w-md rounded-2xl border border-[var(--line)] p-6"><div className="flex gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 text-red-300"><Trash2 size={18} /></span><div><h2 className="font-semibold text-[var(--text)]">{t("inventory.delete")}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("inventory.deleteConfirm", { name: deleteTarget.product_display_name })}</p></div></div><div className="mt-6 flex justify-end gap-3"><button className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm font-semibold text-[var(--text)]" type="button" disabled={busy} onClick={() => setDeleteTarget(null)}>{t("common.cancel")}</button><button className="rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="button" disabled={busy} onClick={() => void handleDelete()}>{busy ? t("inventory.deleting") : t("inventory.delete")}</button></div></div></div> : null}</main>;
}
