"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  MessageSquarePlus,
  MessagesSquare,
  MoreHorizontal,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useConversations } from "@/components/providers/conversation-provider";
import { buildConversationTitle, formatRelativeDay } from "@/lib/format";

type SidebarProps = {
  compact: boolean;
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
};

export function Sidebar({ compact, open, onClose, onOpenSettings }: SidebarProps) {
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
        className={`glass-strong hairline fixed inset-y-0 left-0 z-50 flex w-[19rem] flex-col rounded-r-[2rem] p-4 transition duration-300 lg:sticky lg:top-4 lg:m-4 lg:h-[calc(100vh-2rem)] lg:translate-x-0 lg:rounded-[2rem] ${widthClass} ${open ? "translate-x-0" : "-translate-x-[105%]"}`}
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div>
              <h2 className="serif text-3xl leading-none">Stylist AI</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {auth.user?.display_name ?? "Guest stylist"}
              </p>
            </div>
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] lg:hidden"
            onClick={onClose}
            type="button"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <button
          className="mb-5 inline-flex items-center justify-center gap-2 rounded-[1.2rem] bg-[var(--text)] px-4 py-4 text-sm font-semibold text-[var(--accent-ink)] transition hover:opacity-95"
          type="button"
          onClick={() => {
            router.push("/chat/new");
            onClose();
          }}
        >
          <MessageSquarePlus size={16} />
          New conversation
        </button>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`flex w-full items-center gap-3 rounded-[1.1rem] px-4 py-3 text-sm transition ${item.active ? "bg-[rgba(143,79,43,0.12)] text-[var(--text)]" : "text-[var(--muted)]"} ${item.disabled ? "cursor-default opacity-70" : "hover:bg-white/55 hover:text-[var(--text)]"}`}
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

        <div className="mt-8 flex-1 overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-white/35">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <p className="text-sm text-[var(--text)]">Chat history</p>
            <span className="rounded-full bg-white/70 px-2 py-1 text-xs text-[var(--muted)]">
              {conversations.length}
            </span>
          </div>

          <div className="h-full space-y-2 overflow-hidden p-3">
            {loading ? (
              <p className="rounded-[1rem] bg-white/60 px-3 py-4 text-sm text-[var(--muted)]">
                Loading history...
              </p>
            ) : null}

            {!loading && conversations.length === 0 ? (
              <p className="rounded-[1rem] bg-white/60 px-3 py-4 text-sm text-[var(--muted)]">
                No conversations have been created yet.
              </p>
            ) : null}

            {conversations.map((conversation) => {
              const active = pathname.includes(conversation.id);
              return (
                <button
                  key={conversation.id}
                  className={`block w-full rounded-[1rem] px-3 py-3 text-left transition ${active ? "bg-[rgba(143,79,43,0.14)]" : "bg-white/55 hover:bg-white/80"}`}
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

        <div className="relative mt-4" ref={menuRef}>
          <button
            className="inline-flex w-full items-center justify-between gap-3 rounded-[1.2rem] border border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)] transition hover:bg-white/55 hover:text-[var(--text)]"
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="truncate text-left">{auth.user?.display_name ?? "Account"}</span>
            <MoreHorizontal size={16} />
          </button>

          {menuOpen ? (
            <div className="absolute bottom-[calc(100%+0.75rem)] left-0 right-0 rounded-[1.2rem] border border-[var(--line)] bg-[rgba(255,248,241,0.96)] p-2 shadow-[0_20px_50px_rgba(76,47,26,0.16)] backdrop-blur">
              <button
                className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-3 text-left text-sm text-[var(--text)] transition hover:bg-white/80"
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
                className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-3 text-left text-sm text-[var(--text)] transition hover:bg-white/80"
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
