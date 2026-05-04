"use client";

import { useState } from "react";
import { PanelsTopLeft, UserRound } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { formatShortDate } from "@/lib/format";
import { readPreferences, writePreferences } from "@/lib/storage";
import type { SettingsPreferences } from "@/lib/types";

type SettingsSection = "general" | "account";

export function SettingsView() {
  const auth = useAuth();
  const [preferences, setPreferences] = useState<SettingsPreferences>(() => readPreferences());
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  function updatePreferences(nextPreferences: SettingsPreferences) {
    setPreferences(nextPreferences);
    writePreferences(nextPreferences);
    window.dispatchEvent(new Event("preferences:changed"));
  }

  const sections = [
    {
      id: "general" as const,
      label: "General",
      description: "Workspace and interface",
      icon: PanelsTopLeft,
    },
    {
      id: "account" as const,
      label: "Account",
      description: "Profile and access",
      icon: UserRound,
    },
  ];

  return (
    <div className="grid gap-4 lg:min-h-[28rem] lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="rounded-[1.8rem] border border-[var(--line)] bg-white/58 p-3">
        <div className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;

            return (
              <button
                key={section.id}
                className={`flex w-full items-start gap-3 rounded-[1.2rem] px-4 py-4 text-left transition ${active ? "bg-[rgba(143,79,43,0.12)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-white/72 hover:text-[var(--text)]"}`}
                type="button"
                onClick={() => setActiveSection(section.id)}
              >
                <span
                  className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? "bg-[rgba(143,79,43,0.16)]" : "bg-white/72"}`}
                >
                  <Icon size={16} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{section.label}</span>
                  <span className="mt-1 block text-xs leading-5 opacity-80">
                    {section.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="space-y-4">
        {activeSection === "general" ? (
          <article className="min-h-[28rem] rounded-[1.8rem] border border-[var(--line)] bg-white/72 p-6">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">General</p>
            <div className="mt-6 space-y-4">
              <PreferenceRow
                checked={preferences.compactSidebar}
                description="Reduce the sidebar width to give the workspace more room."
                label="Compact sidebar"
                onToggle={() =>
                  updatePreferences({
                    ...preferences,
                    compactSidebar: !preferences.compactSidebar,
                  })
                }
              />
              <PreferenceRow
                checked={preferences.showRecommendationPanel}
                description="Show or hide the side panel where outfits and garments are rendered."
                label="Recommendation panel"
                onToggle={() =>
                  updatePreferences({
                    ...preferences,
                    showRecommendationPanel: !preferences.showRecommendationPanel,
                  })
                }
              />
            </div>
          </article>
        ) : null}

        {activeSection === "account" ? (
          <article className="min-h-[28rem] rounded-[1.8rem] border border-[var(--line)] bg-white/72 p-6">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Account</p>
            <h2 className="serif mt-3 text-3xl leading-none">{auth.user?.display_name}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.2rem] bg-[rgba(143,79,43,0.06)] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Email</p>
                <p className="mt-2 text-sm text-[var(--text)]">{auth.user?.email || "Not available"}</p>
              </div>
              <div className="rounded-[1.2rem] bg-[rgba(143,79,43,0.06)] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Member since</p>
                <p className="mt-2 text-sm text-[var(--text)]">
                  {auth.user?.created_at ? formatShortDate(auth.user.created_at) : "Not available"}
                </p>
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}

type PreferenceRowProps = {
  checked: boolean;
  description: string;
  label: string;
  onToggle: () => void;
};

function PreferenceRow({ checked, description, label, onToggle }: PreferenceRowProps) {
  return (
    <button
      className="flex w-full items-start justify-between gap-4 rounded-[1.4rem] border border-[var(--line)] bg-white/68 px-4 py-4 text-left transition hover:bg-white/90"
      type="button"
      onClick={onToggle}
    >
      <div>
        <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
      </div>
      <span
        className={`mt-1 inline-flex h-7 w-12 shrink-0 rounded-full p-1 transition ${checked ? "bg-[var(--accent)]" : "bg-[rgba(143,79,43,0.18)]"}`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}
