"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  MessageSquarePlus,
  MessagesSquare,
  MoreHorizontal,
  PanelLeftClose,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useConversations } from "@/components/providers/conversation-provider";
import { buildConversationTitle, formatRelativeDay } from "@/lib/format";

type SidebarProps = {
  compact: boolean;
  desktopVisible: boolean;
  open: boolean;
  onCollapse: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
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
  const { conversations, loading } = useConversations();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const navItems = [
    {
      label: "Chat",
      icon: MessagesSquare,
      active: pathname.startsWith("/chat"),
      disabled: false,
      onClick: () => router.push("/chat/new"),
    },
    {
      label: "Create your style",
      icon: Sparkles,
      active: false,
      disabled: true,
      onClick: () => undefined,
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
                Beta
              </p>
            </div>
          </div>

          <button
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition hover:bg-[var(--surface-high)] hover:text-[var(--text)] lg:inline-flex"
            onClick={onCollapse}
            type="button"
            aria-label="Hide sidebar"
          >
            <PanelLeftClose size={17} />
          </button>

          <button
            className="inline-flex h-8 w-8 items-center justify-center text-[var(--muted)] transition hover:text-[var(--text)] lg:hidden"
            onClick={onClose}
            type="button"
            aria-label="Close menu"
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
          New conversation
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
            <p className="text-sm text-[var(--text)]">Chat history</p>
            <span className="text-xs tabular-nums text-[var(--muted)]">
              {conversations.length}
            </span>
          </div>

          <div className="scroll-modal min-h-0 flex-1 space-y-1 overflow-y-auto py-2 pb-4">
            {loading ? (
              <p className="px-3 py-4 text-sm text-[var(--muted)]">
                Loading history...
              </p>
            ) : null}

            {!loading && conversations.length === 0 ? (
              <p className="px-3 py-4 text-sm text-[var(--muted)]">
                No conversations have been created yet.
              </p>
            ) : null}

            {conversations.map((conversation) => {
              const active = pathname.includes(conversation.id);
              return (
                <button
                  key={conversation.id}
                  className={`option-row block w-full px-3 py-3 text-left ${active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-high)]"}`}
                  type="button"
                  onClick={() => {
                    router.push(`/chat/${conversation.id}`);
                    onClose();
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">
                      {buildConversationTitle(conversation)}
                    </p>
                    <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                      {formatRelativeDay(conversation.updated_at)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                    {conversation.last_message_preview || "No messages yet."}
                  </p>
                </button>
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
            <span className="truncate text-left">{auth.user?.display_name ?? "Account"}</span>
            <MoreHorizontal size={16} />
          </button>

          {menuOpen ? (
            <div className="absolute bottom-[calc(100%+0.75rem)] left-0 right-0 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-high)] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
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
                Settings
              </button>
              <button
                className="option-row flex w-full items-center gap-3 px-3 py-3 text-left text-sm text-[var(--text)] hover:bg-[var(--accent-soft)]"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  auth.signOut();
                  router.replace("/login");
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
