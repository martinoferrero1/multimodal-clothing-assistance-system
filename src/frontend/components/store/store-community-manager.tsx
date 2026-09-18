"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, MapPin, Pencil, Plus, Rss, Store, Trash2 } from "lucide-react";

import { createStoreCommunityListing, deleteStoreCommunityListing, listStoreCommunityListings, updateStoreCommunityListing } from "@/lib/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import type { CommunityListingKind, CommunityListingWrite, StoreCommunityListing } from "@/lib/types";

const emptyListing: CommunityListingWrite = { kind: "blog", title: "", description: "", location: "", external_url: "", starts_at: null, ends_at: null, join_code: "" };
const kinds: CommunityListingKind[] = ["blog", "event", "space"];

function draftFrom(listing: StoreCommunityListing): CommunityListingWrite {
  return {
    kind: listing.kind,
    title: listing.title,
    description: listing.description ?? "",
    location: listing.location ?? "",
    external_url: listing.external_url ?? "",
    starts_at: listing.starts_at ? listing.starts_at.slice(0, 16) : null,
    ends_at: listing.ends_at ? listing.ends_at.slice(0, 16) : null,
    join_code: listing.join_code ?? "",
  };
}

function cleanDraft(draft: CommunityListingWrite): CommunityListingWrite {
  return Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value === "" ? null : value])) as CommunityListingWrite;
}

export function StoreCommunityManager() {
  const auth = useAuth();
  const { t } = useLocale();
  const [listings, setListings] = useState<StoreCommunityListing[]>([]);
  const [draft, setDraft] = useState<CommunityListingWrite>(emptyListing);
  const [editing, setEditing] = useState<StoreCommunityListing | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreCommunityListing | null>(null);
  const canManage = auth.selectedStore?.status === "active";

  useEffect(() => {
    if (!canManage) return;
    void listStoreCommunityListings().then(setListings).catch(() => setError(t("community.loadError"))).finally(() => setLoading(false));
  }, [canManage, t]);

  function resetForm() { setDraft(emptyListing); setEditing(null); setShowForm(false); }
  function startCreate() { setError(null); setNotice(null); setDraft(emptyListing); setEditing(null); setShowForm(true); }
  function startEdit(listing: StoreCommunityListing) { setError(null); setNotice(null); setDraft(draftFrom(listing)); setEditing(listing); setShowForm(true); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const saved = editing
        ? await updateStoreCommunityListing(editing.id, cleanDraft(draft))
        : await createStoreCommunityListing(cleanDraft(draft));
      setListings((current) => editing ? current.map((listing) => listing.id === saved.id ? saved : listing) : [saved, ...current]);
      setNotice(editing ? t("community.updated") : t("community.saved"));
      resetForm();
    } catch { setError(t("community.saveError")); } finally { setBusy(false); }
  }

  async function remove() {
    if (!deleteTarget || busy) return;
    setBusy(true); setError(null);
    try {
      await deleteStoreCommunityListing(deleteTarget.id);
      setListings((current) => current.filter((listing) => listing.id !== deleteTarget.id));
      setNotice(t("community.deleted"));
      setDeleteTarget(null);
    } catch { setError(t("community.deleteError")); } finally { setBusy(false); }
  }

  if (!canManage) return <main className="flex min-h-screen items-center justify-center p-6"><div className="glass rounded-[2rem] p-8 text-sm text-[var(--muted)]">{t("inventory.accessDenied")}</div></main>;

  return <main className="home-background min-h-screen px-5 py-5 sm:px-8 sm:py-7 lg:px-12"><div className="mx-auto max-w-7xl">
    <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5"><div className="flex min-w-0 items-center gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line-strong)] bg-[var(--accent-soft)] text-[var(--accent)]"><Store size={19} /></span><div className="min-w-0"><p className="serif truncate text-2xl leading-none text-[var(--text)]">Lookeate</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{t("community.storeArea")}</p></div></div><Link className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-high)] hover:text-[var(--text)]" href="/store/inventory"><ArrowLeft size={14} />{t("home.storeCatalogTitle")}</Link></header>
    <section className="glass soft-shadow mt-7 rounded-[2rem] border border-[var(--line)] p-6 sm:p-9"><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">{t("community.storeArea")}</p><div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-2xl"><h1 className="serif text-4xl leading-none tracking-[-0.04em] text-[var(--text)] sm:text-5xl">{t("community.manageTitle")}</h1><p className="mt-4 text-sm leading-6 text-[var(--muted)] sm:text-base">{t("community.manageDescription")}</p></div><button className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#111] transition hover:bg-zinc-200" type="button" onClick={startCreate}><Plus size={16} />{t("community.create")}</button></div></section>
    {error ? <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}{notice ? <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p> : null}
    {showForm ? <form className="glass mt-6 rounded-2xl border border-[var(--line)] p-5 sm:p-7" onSubmit={(event) => void save(event)}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-[var(--text)]">{editing ? t("community.edit") : t("community.create")}</h2><p className="mt-1 text-sm text-[var(--muted)]">{t("community.manageDescription")}</p></div><button className="text-sm text-[var(--muted)] hover:text-[var(--text)]" type="button" onClick={resetForm}>{t("common.cancel")}</button></div><div className="mt-6 grid gap-4 md:grid-cols-2"><label className="text-xs font-medium text-[var(--muted)]">{t("community.kind")}<select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as CommunityListingKind }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]">{kinds.map((kind) => <option key={kind} value={kind}>{t(`community.${kind}` as "community.blog")}</option>)}</select></label><label className="text-xs font-medium text-[var(--muted)]">{t("community.name")}<input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label><label className="text-xs font-medium text-[var(--muted)]">{t("community.location")}<input value={draft.location ?? ""} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label><label className="text-xs font-medium text-[var(--muted)]">{t("community.link")}<input type="url" value={draft.external_url ?? ""} onChange={(event) => setDraft((current) => ({ ...current, external_url: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label><label className="text-xs font-medium text-[var(--muted)]">{t("community.start")}<input required={draft.kind === "event"} type="datetime-local" value={draft.starts_at ?? ""} onChange={(event) => setDraft((current) => ({ ...current, starts_at: event.target.value || null }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label><label className="text-xs font-medium text-[var(--muted)]">{t("community.end")}<input type="datetime-local" value={draft.ends_at ?? ""} onChange={(event) => setDraft((current) => ({ ...current, ends_at: event.target.value || null }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label><label className="text-xs font-medium text-[var(--muted)]">{t("community.joinCode")}<input value={draft.join_code ?? ""} onChange={(event) => setDraft((current) => ({ ...current, join_code: event.target.value }))} placeholder="summer-26" className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" /><span className="mt-1 block text-[11px] font-normal leading-4 text-[var(--muted)]">{t("community.joinCodeHint")}</span></label></div><label className="mt-4 block text-xs font-medium text-[var(--muted)]">{t("community.details")}<textarea rows={4} value={draft.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label><div className="mt-6 flex justify-end"><button className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#111] disabled:opacity-60" type="submit" disabled={busy}>{editing ? t("community.saveChanges") : t("community.save")}</button></div></form> : null}
    <section className="mt-8"><h2 className="text-base font-semibold text-[var(--text)]">{t("community.manageTitle")}</h2>{loading ? <p className="mt-5 text-sm text-[var(--muted)]">{t("workspace.connecting")}</p> : listings.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-[var(--line-strong)] p-8 text-sm text-[var(--muted)]">{t("community.empty")}</div> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => { const Icon = listing.kind === "blog" ? Rss : listing.kind === "event" ? CalendarDays : MapPin; return <article key={listing.id} className="glass rounded-2xl border border-[var(--line)] p-5"><div className="flex items-start justify-between gap-4"><span className="rounded-xl bg-[var(--accent-soft)] p-2 text-[var(--accent)]"><Icon size={17} /></span><div className="flex gap-1"><button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)]" type="button" aria-label={t("community.edit")} onClick={() => startEdit(listing)}><Pencil size={14} /></button><button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 text-red-300" type="button" aria-label={t("community.delete")} onClick={() => setDeleteTarget(listing)}><Trash2 size={14} /></button></div></div><p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{t(`community.${listing.kind}` as "community.blog")}</p><h3 className="serif mt-2 text-2xl leading-tight text-[var(--text)]">{listing.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{listing.description || "—"}</p></article>; })}</div>}</section>
  </div>{deleteTarget ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"><div className="modal-shell w-full max-w-md rounded-2xl border border-[var(--line)] p-6"><h2 className="font-semibold text-[var(--text)]">{t("community.delete")}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("community.deleteConfirm", { title: deleteTarget.title })}</p><div className="mt-6 flex justify-end gap-3"><button className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm font-semibold text-[var(--text)]" type="button" disabled={busy} onClick={() => setDeleteTarget(null)}>{t("common.cancel")}</button><button className="rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white" type="button" disabled={busy} onClick={() => void remove()}>{t("community.delete")}</button></div></div></div> : null}</main>;
}
