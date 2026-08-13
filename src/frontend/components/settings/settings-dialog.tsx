"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { useLocale } from "@/components/providers/locale-provider";
import { SettingsView, type SettingsSection } from "@/components/settings/settings-view";

type SettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { t } = useLocale();
  const [section, setSection] = useState<SettingsSection>("general");
  const sectionTitle = section === "general"
    ? t("workspace.general")
    : section === "assistant"
      ? t("sidebar.assistant")
      : t("workspace.account");

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 sm:p-6">
      <button
        className="absolute inset-0 cursor-default"
        type="button"
        tabIndex={-1}
        aria-label={t("workspace.closeSettings")}
        onClick={onClose}
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
              aria-label={t("workspace.closeSettings")}
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center px-5 py-3 sm:px-6">
            <h2
              id="settings-dialog-title"
              className="text-base font-semibold leading-none text-[var(--text)]"
            >
              {sectionTitle}
            </h2>
          </div>
        </div>

        <div className="modal-body scroll-modal min-h-0 flex-1 overflow-y-auto">
          <SettingsView
            activeSection={section}
            onSectionChange={setSection}
          />
        </div>
      </div>
    </div>
  );
}
