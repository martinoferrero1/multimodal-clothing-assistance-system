"use client";

import { useEffect, useState } from "react";
import { Menu, Sparkles, X } from "lucide-react";

import { SettingsView } from "@/components/settings/settings-view";
import { Sidebar } from "@/components/workspace/sidebar";
import { readPreferences } from "@/lib/storage";
import { useAuth } from "@/components/providers/auth-provider";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(() => readPreferences().compactSidebar);

  useEffect(() => {
    function syncPreferences() {
      const preferences = readPreferences();
      setCompactSidebar(preferences.compactSidebar);
    }

    window.addEventListener("preferences:changed", syncPreferences);
    return () => window.removeEventListener("preferences:changed", syncPreferences);
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen]);

  return (
    <div className="relative min-h-screen overflow-hidden lg:h-screen">
      <div className="page-orb left-[-5rem] top-[-6rem] h-64 w-64 bg-[rgba(223,191,164,0.42)]" />
      <div className="page-orb bottom-[-7rem] right-[-3rem] h-80 w-80 bg-[rgba(143,79,43,0.12)]" />

      <div className="relative z-10 flex min-h-screen lg:h-screen">
        <Sidebar
          compact={compactSidebar}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="flex min-h-screen flex-1 flex-col lg:h-screen lg:overflow-hidden lg:pl-4">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:hidden">
            <button
              className="glass hairline inline-flex h-12 w-12 items-center justify-center rounded-full"
              onClick={() => setSidebarOpen(true)}
              type="button"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="glass hairline flex items-center gap-3 rounded-full px-4 py-3">
              <Sparkles size={16} className="text-[var(--accent)]" />
              <div>
                <p className="serif text-lg leading-none">Stylist AI</p>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  {auth.user?.display_name ?? "Stylist session"}
                </p>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 pb-4 sm:px-6 lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pr-4 lg:pb-4">
            {children}
          </div>
        </div>
      </div>

      {settingsOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(32,20,12,0.36)] p-4 sm:p-6">
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="glass-strong hairline soft-shadow relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-[2rem] px-5 py-5 sm:px-6">
            <div className="mb-4 flex justify-end">
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white/60 transition hover:bg-white/85"
                type="button"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <SettingsView />
          </div>
        </div>
      ) : null}
    </div>
  );
}
