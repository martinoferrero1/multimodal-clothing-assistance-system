"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  EllipsisVertical,
  GripVertical,
  House,
  LogOut,
  MessageSquarePlus,
  MessagesSquare,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Pin,
  PinOff,
  Settings,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useConversations } from "@/components/providers/conversation-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { buildConversationTitle, formatRelativeDay } from "@/lib/format";

type SidebarProps = {
  compact: boolean;
  desktopVisible: boolean;
  open: boolean;
  onCollapse: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
};

type ConversationMenuState = {
  id: string;
  title: string;
  isPinned: boolean;
  left: number;
  top: number;
  error: string | null;
};

export function Sidebar({
  compact,
  desktopVisible,
  open,
  onCollapse,
  onClose,
  onOpenSettings,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { t } = useLocale();
  const {
    conversations,
    deleteConversation,
    loading,
    reorderConversations,
    updateConversation,
  } = useConversations();
  const [menuOpen, setMenuOpen] = useState(false);
  const [conversationMenu, setConversationMenu] = useState<ConversationMenuState | null>(null);
  const [updatingPinnedConversation, setUpdatingPinnedConversation] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renamingConversation, setRenamingConversation] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [draggingConversationId, setDraggingConversationId] = useState<string | null>(null);
  const [dragOverConversationId, setDragOverConversationId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const conversationMenuRef = useRef<HTMLDivElement | null>(null);

  const navItems = [
    {
      label: t("sidebar.home"),
      icon: House,
      active: pathname === "/",
      disabled: false,
      onClick: () => router.push("/"),
    },
    {
      label: t("sidebar.assistant"),
      icon: MessagesSquare,
      active: pathname.startsWith("/chat"),
      disabled: false,
      onClick: () => router.push("/chat/new"),
    },
  ];

  const widthClass = compact ? "lg:w-[18rem]" : "lg:w-[20rem] xl:w-[22rem]";

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (!menuOpen) {
      return;
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!conversationMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!conversationMenuRef.current?.contains(event.target as Node)) {
        setConversationMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConversationMenu(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [conversationMenu]);

  useEffect(() => {
    if ((!deleteTarget && !renameTarget) || deletingConversation || renamingConversation) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDeleteTarget(null);
        setDeleteError(null);
        setRenameTarget(null);
        setRenameError(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget, deletingConversation, renameTarget, renamingConversation]);

  function openConversationMenu(
    button: HTMLButtonElement,
    conversation: { id: string; title: string; isPinned: boolean },
  ) {
    const rect = button.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = 146;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const top = rect.bottom + menuHeight + 8 > window.innerHeight
      ? Math.max(8, rect.top - menuHeight - 6)
      : rect.bottom + 6;

    setConversationMenu({
      ...conversation,
      left,
      top,
      error: null,
    });
  }

  async function handleTogglePinnedConversation() {
    if (!conversationMenu || updatingPinnedConversation) {
      return;
    }

    setUpdatingPinnedConversation(true);
    setConversationMenu((current) => current ? { ...current, error: null } : null);
    try {
      await updateConversation(conversationMenu.id, {
        is_pinned: !conversationMenu.isPinned,
      });
      setConversationMenu(null);
    } catch {
      setConversationMenu((current) => current
        ? { ...current, error: t("sidebar.pinConversationError") }
        : null);
    } finally {
      setUpdatingPinnedConversation(false);
    }
  }

  async function handleRenameConversation() {
    if (!renameTarget || renamingConversation) {
      return;
    }

    const cleanTitle = renameDraft.trim();
    if (!cleanTitle) {
      return;
    }

    setRenamingConversation(true);
    setRenameError(null);
    try {
      await updateConversation(renameTarget.id, { title: cleanTitle });
      setRenameTarget(null);
      setRenameDraft("");
    } catch {
      setRenameError(t("sidebar.renameConversationError"));
    } finally {
      setRenamingConversation(false);
    }
  }

  function canReorderConversation(targetId: string): boolean {
    const source = conversations.find((conversation) => conversation.id === draggingConversationId);
    const target = conversations.find((conversation) => conversation.id === targetId);
    return Boolean(source && target && source.is_pinned === target.is_pinned);
  }

  async function handleDropConversation(targetId: string) {
    const sourceId = draggingConversationId;
    setDraggingConversationId(null);
    setDragOverConversationId(null);
    if (!sourceId || sourceId === targetId) {
      return;
    }

    const source = conversations.find((conversation) => conversation.id === sourceId);
    const target = conversations.find((conversation) => conversation.id === targetId);
    if (!source || !target || source.is_pinned !== target.is_pinned) {
      return;
    }

    const groupIds = conversations
      .filter((conversation) => conversation.is_pinned === source.is_pinned)
      .map((conversation) => conversation.id);
    const sourceIndex = groupIds.indexOf(sourceId);
    const targetIndex = groupIds.indexOf(targetId);
    groupIds.splice(sourceIndex, 1);
    groupIds.splice(targetIndex, 0, sourceId);

    setReorderError(null);
    try {
      await reorderConversations(groupIds);
    } catch {
      setReorderError(t("sidebar.moveConversationError"));
    }
  }

  async function handleDeleteConversation() {
    if (!deleteTarget || deletingConversation) {
      return;
    }

    const deletingActiveConversation = pathname.includes(deleteTarget.id);
    setDeletingConversation(true);
    setDeleteError(null);

    try {
      await deleteConversation(deleteTarget.id);
      setDeleteTarget(null);
      if (deletingActiveConversation) {
        router.replace("/chat/new");
        onClose();
      }
    } catch {
      setDeleteError(t("sidebar.deleteConversationError"));
    } finally {
      setDeletingConversation(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`surface-sidebar fixed inset-y-0 left-0 z-50 flex w-[19rem] flex-col rounded-r-xl border-r border-[var(--line-strong)] p-3 transition duration-300 lg:sticky lg:top-0 lg:m-0 lg:h-screen lg:translate-x-0 lg:rounded-none lg:border-y-0 lg:border-l-0 ${desktopVisible ? "lg:flex" : "lg:hidden"} ${widthClass} ${open ? "translate-x-0" : "-translate-x-[105%]"}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-2 pb-5 pt-2">
          <div className="space-y-2">
            <div>
              <h2 className="serif text-3xl leading-none">Lookeate</h2>
              <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                {t("sidebar.assistant")}
              </p>
            </div>
          </div>

          <button
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition hover:bg-[var(--surface-high)] hover:text-[var(--text)] lg:inline-flex"
            onClick={onCollapse}
            type="button"
            aria-label={t("sidebar.hide")}
          >
            <PanelLeftClose size={17} />
          </button>

          <button
            className="inline-flex h-8 w-8 items-center justify-center text-[var(--muted)] transition hover:text-[var(--text)] lg:hidden"
            onClick={onClose}
            type="button"
            aria-label={t("sidebar.closeMenu")}
          >
            <X size={18} />
          </button>
        </div>

        <button
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-high)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          type="button"
          onClick={() => {
            router.push("/chat/new");
            onClose();
          }}
        >
          <MessageSquarePlus size={16} />
          {t("sidebar.newConversation")}
        </button>

        <nav className="mt-4 space-y-1 border-b border-[var(--line)] pb-4">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`option-row flex w-full items-center gap-3 px-3 py-2.5 text-sm ${item.active ? "bg-[var(--accent-soft)] font-semibold text-[var(--text)]" : "text-[var(--muted)]"} ${item.disabled ? "cursor-default opacity-70" : "hover:bg-[var(--surface-high)] hover:text-[var(--text)]"}`}
                type="button"
                aria-disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) {
                    return;
                  }

                  item.onClick();
                  onClose();
                }}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-[var(--line)] px-3 py-3">
            <p className="text-sm text-[var(--text)]">{t("sidebar.chatHistory")}</p>
            <span className="text-xs tabular-nums text-[var(--muted)]">
              {conversations.length}
            </span>
          </div>

          <div className="scroll-modal min-h-0 flex-1 space-y-1 overflow-y-auto py-2 pb-4">
            {loading ? (
              <p className="px-3 py-4 text-sm text-[var(--muted)]">
                {t("sidebar.loadingHistory")}
              </p>
            ) : null}

            {!loading && conversations.length === 0 ? (
              <p className="px-3 py-4 text-sm text-[var(--muted)]">
                {t("sidebar.noConversations")}
              </p>
            ) : null}

            {reorderError ? (
              <p className="px-3 py-2 text-xs leading-5 text-red-300" role="alert">
                {reorderError}
              </p>
            ) : null}

            {conversations.map((conversation) => {
              const active = pathname.includes(conversation.id);
              const conversationTitle = buildConversationTitle(
                conversation,
                t("sidebar.newConversation"),
              );
              return (
                <div
                  key={conversation.id}
                  className={`group option-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 p-1 ${active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-high)]"} ${dragOverConversationId === conversation.id ? "outline outline-1 outline-[var(--accent)]" : ""} ${draggingConversationId === conversation.id ? "opacity-45" : ""}`}
                  onDragOver={(event) => {
                    if (!canReorderConversation(conversation.id)) {
                      return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverConversationId(conversation.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverConversationId === conversation.id) {
                      setDragOverConversationId(null);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    void handleDropConversation(conversation.id);
                  }}
                >
                  <span
                    className="inline-flex h-9 w-6 cursor-grab items-center justify-center text-[var(--muted-soft)] opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
                    draggable
                    title={t("sidebar.moveConversation")}
                    aria-label={t("sidebar.moveConversation")}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", conversation.id);
                      setDraggingConversationId(conversation.id);
                      setReorderError(null);
                    }}
                    onDragEnd={() => {
                      setDraggingConversationId(null);
                      setDragOverConversationId(null);
                    }}
                  >
                    <GripVertical size={15} />
                  </span>
                  <button
                    className="min-w-0 px-2 py-2 text-left"
                    type="button"
                    onClick={() => {
                      router.push(`/chat/${conversation.id}`);
                      onClose();
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-1.5">
                        {conversation.is_pinned ? (
                          <Pin
                            size={12}
                            className="mt-1 shrink-0 text-[var(--accent)]"
                            aria-label={t("sidebar.pinnedConversation")}
                          />
                        ) : null}
                        <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">
                          {conversationTitle}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                        {formatRelativeDay(conversation.updated_at, t)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                      {conversation.last_message_preview || t("sidebar.noMessages")}
                    </p>
                  </button>
                  <button
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-high)] hover:text-[var(--text)] focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] ${conversationMenu?.id === conversation.id ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"}`}
                    type="button"
                    title={t("sidebar.openConversationActions")}
                    aria-label={t("sidebar.openConversationActions")}
                    aria-haspopup="menu"
                    aria-expanded={conversationMenu?.id === conversation.id}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      if (conversationMenu?.id === conversation.id) {
                        setConversationMenu(null);
                        return;
                      }
                      openConversationMenu(event.currentTarget, {
                        id: conversation.id,
                        title: conversationTitle,
                        isPinned: conversation.is_pinned,
                      });
                    }}
                  >
                    <EllipsisVertical size={17} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative -mx-3 -mb-3 border-y border-[var(--line)] px-3 pb-3 pt-3" ref={menuRef}>
          <button
            className="option-row inline-flex w-full items-center justify-between gap-3 border border-transparent px-3 py-3 text-sm text-[var(--muted)] hover:border-[var(--line)] hover:bg-[var(--surface-high)] hover:text-[var(--text)]"
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="truncate text-left">
              {auth.user?.display_name ?? t("common.account")}
            </span>
            <MoreHorizontal size={16} />
          </button>

          {menuOpen ? (
            <div className="floating-shadow absolute bottom-[calc(100%+0.75rem)] left-0 right-0 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-high)] p-2">
              <button
                className="option-row flex w-full items-center gap-3 px-3 py-3 text-left text-sm text-[var(--text)] hover:bg-[var(--accent-soft)]"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSettings();
                  onClose();
                }}
              >
                <Settings size={16} />
                {t("sidebar.settings")}
              </button>
              <button
                className="option-row flex w-full items-center gap-3 px-3 py-3 text-left text-sm text-[var(--text)] hover:bg-[var(--accent-soft)]"
                type="button"
                onClick={async () => {
                  setMenuOpen(false);
                  await auth.signOut();
                  router.replace("/login");
                }}
              >
                <LogOut size={16} />
                {t("sidebar.signOut")}
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      {conversationMenu ? (
        <div
          ref={conversationMenuRef}
          className="floating-shadow fixed z-[70] w-52 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-high)] p-1.5"
          style={{ left: conversationMenu.left, top: conversationMenu.top }}
          role="menu"
          aria-label={t("sidebar.openConversationActions")}
        >
          {conversationMenu.error ? (
            <p className="px-3 py-2 text-xs leading-5 text-red-300" role="alert">
              {conversationMenu.error}
            </p>
          ) : null}
          <button
            className="option-row flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
            type="button"
            role="menuitem"
            disabled={updatingPinnedConversation}
            onClick={() => {
              setRenameTarget({ id: conversationMenu.id, title: conversationMenu.title });
              setRenameDraft(conversationMenu.title);
              setRenameError(null);
              setConversationMenu(null);
            }}
          >
            <Pencil size={15} />
            {t("sidebar.renameConversation")}
          </button>
          <button
            className="option-row flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
            type="button"
            role="menuitem"
            disabled={updatingPinnedConversation}
            onClick={() => void handleTogglePinnedConversation()}
          >
            {conversationMenu.isPinned ? <PinOff size={15} /> : <Pin size={15} />}
            {conversationMenu.isPinned
              ? t("sidebar.unpinConversation")
              : t("sidebar.pinConversation")}
          </button>
          <div className="my-1 border-t border-[var(--line)]" />
          <button
            className="option-row flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-red-300 hover:bg-red-400/10 disabled:opacity-60"
            type="button"
            role="menuitem"
            disabled={updatingPinnedConversation}
            onClick={() => {
              setDeleteError(null);
              setDeleteTarget({ id: conversationMenu.id, title: conversationMenu.title });
              setConversationMenu(null);
            }}
          >
            <Trash2 size={15} />
            {t("sidebar.deleteConversation")}
          </button>
        </div>
      ) : null}

      {renameTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 sm:p-6">
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            tabIndex={-1}
            aria-label={t("common.close")}
            disabled={renamingConversation}
            onClick={() => {
              setRenameTarget(null);
              setRenameError(null);
            }}
          />
          <form
            className="modal-shell relative z-10 w-full max-w-md overflow-hidden rounded-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-conversation-dialog-title"
            onSubmit={(event) => {
              event.preventDefault();
              void handleRenameConversation();
            }}
          >
            <div className="border-b border-[var(--line)] px-5 py-5 sm:px-6">
              <h2
                id="rename-conversation-dialog-title"
                className="text-base font-semibold text-[var(--text)]"
              >
                {t("sidebar.renameConversationTitle")}
              </h2>
              <label
                className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"
                htmlFor="rename-conversation-input"
              >
                {t("sidebar.conversationName")}
              </label>
              <input
                id="rename-conversation-input"
                className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-low)] px-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                type="text"
                autoFocus
                maxLength={160}
                disabled={renamingConversation}
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
              />
              {renameError ? (
                <p className="mt-3 text-sm text-red-300" role="alert">
                  {renameError}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 px-5 py-5 sm:px-6">
              <button
                className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-high)] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={renamingConversation}
                onClick={() => {
                  setRenameTarget(null);
                  setRenameError(null);
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                className="rounded-lg bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-ink)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={renamingConversation || !renameDraft.trim()}
              >
                {renamingConversation ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 sm:p-6">
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            tabIndex={-1}
            aria-label={t("common.close")}
            disabled={deletingConversation}
            onClick={() => {
              setDeleteTarget(null);
              setDeleteError(null);
            }}
          />
          <div
            className="modal-shell relative z-10 w-full max-w-md overflow-hidden rounded-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-conversation-dialog-title"
            aria-describedby="delete-conversation-dialog-description"
          >
            <div className="flex items-start gap-4 border-b border-[var(--line)] px-5 py-5 sm:px-6">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-400/25 bg-red-400/10 text-red-300">
                <Trash2 size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id="delete-conversation-dialog-title"
                  className="text-base font-semibold text-[var(--text)]"
                >
                  {t("sidebar.deleteConversationTitle")}
                </h2>
                <p
                  id="delete-conversation-dialog-description"
                  className="mt-2 text-sm leading-6 text-[var(--muted)]"
                >
                  {t("sidebar.deleteConversationDescription", { title: deleteTarget.title })}
                </p>
              </div>
            </div>

            {deleteError ? (
              <p className="mx-5 mt-4 text-sm text-red-300 sm:mx-6" role="alert">
                {deleteError}
              </p>
            ) : null}

            <div className="flex justify-end gap-3 px-5 py-5 sm:px-6">
              <button
                className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-high)] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                autoFocus
                disabled={deletingConversation}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={deletingConversation}
                onClick={() => void handleDeleteConversation()}
              >
                <Trash2 size={15} />
                {deletingConversation
                  ? t("sidebar.deletingConversation")
                  : t("sidebar.deleteConversationConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
