"use client";

import { useEffect, useState } from "react";
import { Menu, PanelLeftOpen, Sparkles, X } from "lucide-react";

import { SettingsView, type SettingsSection } from "@/components/settings/settings-view";
import { Sidebar } from "@/components/workspace/sidebar";
import { readPreferences } from "@/lib/storage";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarVisible, setDesktopSidebarVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [compactSidebar, setCompactSidebar] = useState(() => readPreferences().compactSidebar);
  const settingsSectionTitle = settingsSection === "general" ? "General" : "Account";

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
    <div className="app-background relative min-h-screen overflow-hidden lg:h-screen">
      <div className="relative z-10 flex min-h-screen lg:h-screen">
        <Sidebar
          compact={compactSidebar}
          desktopVisible={desktopSidebarVisible}
          open={sidebarOpen}
          onCollapse={() => setDesktopSidebarVisible(false)}
          onClose={() => setSidebarOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {!desktopSidebarVisible ? (
          <button
            className="surface-chrome absolute left-4 top-4 z-40 hidden h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition hover:text-[var(--text)] lg:inline-flex"
            type="button"
            aria-label="Show sidebar"
            onClick={() => setDesktopSidebarVisible(true)}
          >
            <PanelLeftOpen size={18} />
          </button>
        ) : null}

        <div className="flex min-h-screen flex-1 flex-col lg:h-screen lg:overflow-hidden">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:hidden">
            <button
              className="glass hairline inline-flex h-12 w-12 items-center justify-center rounded-full"
              onClick={() => setSidebarOpen(true)}
              type="button"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="surface-chrome flex items-center gap-3 rounded-lg border border-[var(--line)] px-4 py-3">
              <Sparkles size={16} className="text-[var(--accent)]" />
              <div>
                <p className="serif text-lg leading-none">Stylist AI</p>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Beta
                </p>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 pb-4 sm:px-6 lg:min-h-0 lg:overflow-hidden lg:px-4 lg:pb-4">
            {children}
          </div>
        </div>
      </div>

      {settingsOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 sm:p-6">
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            tabIndex={-1}
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            className="modal-shell relative z-10 flex h-[min(44rem,calc(100dvh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-xl sm:h-[min(44rem,calc(100dvh-3rem))]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
          >
            <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] border-b border-[var(--line)] lg:grid-cols-[16rem_minmax(0,1fr)]">
              <div className="flex items-center px-4 py-3 lg:border-r lg:border-[var(--line)]">
                <button
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--muted)] transition hover:text-[var(--text)]"
                  type="button"
                  autoFocus
                  aria-label="Close settings"
                  onClick={() => setSettingsOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center px-5 py-3 sm:px-6">
                <h2 id="settings-dialog-title" className="text-base font-semibold leading-none text-[var(--text)]">
                  {settingsSectionTitle}
                </h2>
              </div>
            </div>

            <div className="modal-body scroll-modal min-h-0 flex-1 overflow-y-auto">
              <SettingsView
                activeSection={settingsSection}
                onSectionChange={setSettingsSection}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
