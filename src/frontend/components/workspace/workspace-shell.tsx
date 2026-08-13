"use client";

import { useEffect, useState } from "react";
import { Menu, PanelLeftOpen, Sparkles } from "lucide-react";

import { useLocale } from "@/components/providers/locale-provider";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { Sidebar } from "@/components/workspace/sidebar";
import { readPreferences } from "@/lib/storage";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarVisible, setDesktopSidebarVisible] = useState(true);
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
            aria-label={t("workspace.showSidebar")}
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
              aria-label={t("workspace.openMenu")}
            >
              <Menu size={20} />
            </button>
            <div className="surface-chrome flex items-center gap-3 rounded-lg border border-[var(--line)] px-4 py-3">
              <Sparkles size={16} className="text-[var(--accent)]" />
              <div>
                <p className="serif text-lg leading-none">Lookeate</p>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  {t("sidebar.assistant")}
                </p>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 pb-4 sm:px-6 lg:min-h-0 lg:overflow-hidden lg:px-4 lg:pb-4">
            {children}
          </div>
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
