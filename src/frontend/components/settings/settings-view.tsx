"use client";

import { useEffect, useState } from "react";
import { Check, PanelsTopLeft, UserRound } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import {
  ApiError,
  clearUserExplicitStylePreferences,
  removeUserInferredStylePreference,
  updateUserSearchPreferences,
  updateUserStylePreferences,
} from "@/lib/api-client";
import { formatShortDate } from "@/lib/format";
import {
  SEARCH_PRIORITY_OPTIONS,
  formatPriorityFields,
  togglePriorityField,
} from "@/lib/search-preferences";
import { readPreferences, writePreferences } from "@/lib/storage";
import type { SearchPriorityField, SettingsPreferences, StylePreferenceDetails } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";

export type SettingsSection = "general" | "account";
type StyleDraft = Record<keyof StylePreferenceDetails, string>;
type LocalizedError = { message: string } | { key: MessageKey };

type SettingsViewProps = {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
};

const styleDraftFields: Array<{ key: keyof StylePreferenceDetails; labelKey: MessageKey; multiline?: boolean }> = [
  { key: "liked_styles", labelKey: "settings.likedStyles" },
  { key: "disliked_styles", labelKey: "settings.dislikedStyles" },
  { key: "preferred_colors", labelKey: "settings.preferredColors" },
  { key: "avoided_colors", labelKey: "settings.avoidedColors" },
  { key: "preferred_brands", labelKey: "settings.preferredBrands" },
  { key: "avoided_brands", labelKey: "settings.avoidedBrands" },
  { key: "preferred_fits", labelKey: "settings.preferredFits" },
  { key: "occasions", labelKey: "settings.occasions" },
  { key: "budget_notes", labelKey: "settings.budgetNotes", multiline: true },
  { key: "sizing_notes", labelKey: "settings.sizingNotes", multiline: true },
  { key: "freeform_notes", labelKey: "settings.styleNotes", multiline: true },
];

export function SettingsView({ activeSection, onSectionChange }: SettingsViewProps) {
  const auth = useAuth();
  const { language, t } = useLocale();
  const authPriorityFields = auth.user?.search_preferences?.priority_fields ?? [];
  const [preferences, setPreferences] = useState<SettingsPreferences>(() => readPreferences());
  const [optimisticSearchPriorityFields, setOptimisticSearchPriorityFields] =
    useState<SearchPriorityField[] | null>(null);
  const [savingSearchPreferences, setSavingSearchPreferences] = useState(false);
  const [searchPreferencesError, setSearchPreferencesError] = useState<LocalizedError | null>(null);
  const [styleDraft, setStyleDraft] = useState<StyleDraft>(() => stylePreferencesToDraft(auth.user?.style_preferences?.explicit));
  const [savingStylePreferences, setSavingStylePreferences] = useState(false);
  const [stylePreferencesError, setStylePreferencesError] = useState<LocalizedError | null>(null);
  const searchPriorityFields = optimisticSearchPriorityFields ?? authPriorityFields;
  const stylePreferences = auth.user?.style_preferences;

  useEffect(() => {
    queueMicrotask(() => {
      setStyleDraft(stylePreferencesToDraft(auth.user?.style_preferences?.explicit));
    });
  }, [auth.user?.style_preferences?.explicit]);

  useEffect(() => {
    function syncPreferences() {
      setPreferences(readPreferences());
    }
    window.addEventListener("preferences:changed", syncPreferences);
    window.addEventListener("storage", syncPreferences);
    return () => {
      window.removeEventListener("preferences:changed", syncPreferences);
      window.removeEventListener("storage", syncPreferences);
    };
  }, []);

  function updatePreferences(nextPreferences: SettingsPreferences) {
    setPreferences(nextPreferences);
    writePreferences(nextPreferences);
    window.dispatchEvent(new Event("preferences:changed"));
  }

  async function handleSearchPriorityToggle(field: SearchPriorityField) {
    if (!auth.token || savingSearchPreferences) {
      return;
    }

    const nextFields = togglePriorityField(searchPriorityFields, field);
    setOptimisticSearchPriorityFields(nextFields);
    setSavingSearchPreferences(true);
    setSearchPreferencesError(null);

    try {
      await updateUserSearchPreferences(auth.token, nextFields);
      await auth.refreshUser();
      setOptimisticSearchPriorityFields(null);
      window.dispatchEvent(new Event("search-preferences:changed"));
    } catch (caughtError) {
      setOptimisticSearchPriorityFields(null);
      setSearchPreferencesError(
        caughtError instanceof ApiError && caughtError.hasExternalMessage
          ? { message: caughtError.message }
          : { key: "settings.searchPrioritiesError" },
      );
    } finally {
      setSavingSearchPreferences(false);
    }
  }

  async function handlePersonalizedStylesToggle() {
    if (!auth.token || savingStylePreferences || !stylePreferences) {
      return;
    }
    setSavingStylePreferences(true);
    setStylePreferencesError(null);
    try {
      await updateUserStylePreferences(auth.token, {
        use_personalized_styles: !stylePreferences.use_personalized_styles,
      });
      await auth.refreshUser();
    } catch (caughtError) {
      setStylePreferencesError(
        caughtError instanceof ApiError && caughtError.hasExternalMessage
          ? { message: caughtError.message }
          : { key: "settings.personalizedStylesError" },
      );
    } finally {
      setSavingStylePreferences(false);
    }
  }

  async function handleSaveExplicitStylePreferences() {
    if (!auth.token || savingStylePreferences) {
      return;
    }
    setSavingStylePreferences(true);
    setStylePreferencesError(null);
    try {
      await updateUserStylePreferences(auth.token, { explicit: draftToStylePreferences(styleDraft) });
      await auth.refreshUser();
    } catch (caughtError) {
      setStylePreferencesError(
        caughtError instanceof ApiError && caughtError.hasExternalMessage
          ? { message: caughtError.message }
          : { key: "settings.saveStylesError" },
      );
    } finally {
      setSavingStylePreferences(false);
    }
  }

  async function handleClearExplicitStylePreferences() {
    if (!auth.token || savingStylePreferences) {
      return;
    }
    setSavingStylePreferences(true);
    setStylePreferencesError(null);
    try {
      await clearUserExplicitStylePreferences(auth.token);
      await auth.refreshUser();
    } catch (caughtError) {
      setStylePreferencesError(
        caughtError instanceof ApiError && caughtError.hasExternalMessage
          ? { message: caughtError.message }
          : { key: "settings.clearStylesError" },
      );
    } finally {
      setSavingStylePreferences(false);
    }
  }

  async function handleRemoveInferredStylePreference(inferredId: string) {
    if (!auth.token || savingStylePreferences) {
      return;
    }
    setSavingStylePreferences(true);
    setStylePreferencesError(null);
    try {
      await removeUserInferredStylePreference(auth.token, inferredId);
      await auth.refreshUser();
    } catch (caughtError) {
      setStylePreferencesError(
        caughtError instanceof ApiError && caughtError.hasExternalMessage
          ? { message: caughtError.message }
          : { key: "settings.removeInferredError" },
      );
    } finally {
      setSavingStylePreferences(false);
    }
  }

  const sections = [
    {
      id: "general" as const,
      label: t("workspace.general"),
      description: t("settings.generalDescription"),
      icon: PanelsTopLeft,
    },
    {
      id: "account" as const,
      label: t("workspace.account"),
      description: t("settings.accountDescription"),
      icon: UserRound,
    },
  ];

  return (
    <div className="grid min-h-full lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="h-fit self-start px-3 py-4 lg:sticky lg:top-0 lg:border-r lg:border-[var(--line)]">
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;

            return (
              <button
                key={section.id}
                className={`option-row flex w-full items-start gap-3 border-l-2 px-3 py-3 text-left ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                    : "border-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                }`}
                type="button"
                onClick={() => onSectionChange(section.id)}
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center">
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

      <div className="px-5 py-5 sm:px-6 lg:px-8">
        {activeSection === "general" ? (
          <div className="space-y-7 pb-8">
            <div className="space-y-0">
              <PreferenceRow
                checked={preferences.compactSidebar}
                description={t("settings.compactSidebarDescription")}
                label={t("settings.compactSidebar")}
                onToggle={() =>
                  updatePreferences({
                    ...preferences,
                    compactSidebar: !preferences.compactSidebar,
                  })
                }
              />
              <PreferenceRow
                checked={preferences.showRecommendationPanel}
                description={t("settings.recommendationPanelDescription")}
                label={t("settings.recommendationPanel")}
                onToggle={() =>
                  updatePreferences({
                    ...preferences,
                    showRecommendationPanel: !preferences.showRecommendationPanel,
                  })
                }
              />
              <div className="border-b border-[var(--line)] px-2 py-4">
                <label className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text)]">
                      {t("settings.language")}
                    </span>
                    <span className="mt-2 block text-sm leading-7 text-[var(--muted)]">
                      {t("settings.languageDescription")}
                    </span>
                  </span>
                  <select
                    className="min-w-40 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                    value={preferences.language}
                    onChange={(event) =>
                      updatePreferences({
                        ...preferences,
                        language: event.target.value === "es" ? "es" : "en",
                      })
                    }
                  >
                    <option value="en">{t("settings.languageEnglish")}</option>
                    <option value="es">{t("settings.languageSpanish")}</option>
                  </select>
                </label>
              </div>
            </div>

            <section className="border-b border-[var(--line)] pb-7">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{t("settings.searchPriorities")}</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {formatPriorityFields(searchPriorityFields, language, t)}
                    </p>
                  </div>
                  {savingSearchPreferences ? (
                    <span className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                      {t("common.saving")}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {SEARCH_PRIORITY_OPTIONS.map((option) => (
                    <SearchPriorityToggle
                      key={option.field}
                      checked={searchPriorityFields.includes(option.field)}
                      disabled={savingSearchPreferences || !auth.token}
                      description={t(option.descriptionKey)}
                      label={t(option.labelKey)}
                      onToggle={() => handleSearchPriorityToggle(option.field)}
                    />
                  ))}
                </div>

                {searchPreferencesError ? (
                  <p className="mt-4 rounded-[1rem] border border-[var(--danger-line)] bg-[var(--danger-surface)] px-3 py-2 text-sm text-[var(--danger)]">
                    {"message" in searchPreferencesError ? searchPreferencesError.message : t(searchPreferencesError.key)}
                  </p>
                ) : null}
            </section>

            <section className="pb-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{t("settings.personalizedStyles")}</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {t("settings.personalizedStylesDescription")}
                    </p>
                  </div>
                  <button
                    className={`mt-1 inline-flex h-7 w-12 shrink-0 rounded-full p-1 transition ${stylePreferences?.use_personalized_styles ? "bg-[var(--accent)]" : "bg-[var(--surface-high)]"}`}
                    type="button"
                    aria-label={t("settings.personalizedStylesLabel")}
                    disabled={!auth.token || savingStylePreferences}
                    aria-pressed={stylePreferences?.use_personalized_styles ?? true}
                    onClick={handlePersonalizedStylesToggle}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-[var(--text)] transition ${stylePreferences?.use_personalized_styles ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {styleDraftFields.map((field) => (
                    <label key={field.key} className={field.multiline ? "sm:col-span-2" : ""}>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        {t(field.labelKey)}
                      </span>
                      <textarea
                        className="mt-2 min-h-[3.2rem] w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-sm leading-6 outline-none transition focus:border-[var(--accent)]"
                        rows={field.multiline ? 3 : 1}
                        placeholder={field.multiline ? t("settings.addNote") : t("settings.commaSeparated")}
                        value={styleDraft[field.key]}
                        onChange={(event) =>
                          setStyleDraft((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={!auth.token || savingStylePreferences}
                    onClick={handleSaveExplicitStylePreferences}
                  >
                    {t("settings.saveStyles")}
                  </button>
                  <button
                    className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={!auth.token || savingStylePreferences}
                    onClick={handleClearExplicitStylePreferences}
                  >
                    {t("settings.clearStyles")}
                  </button>
                  {savingStylePreferences ? (
                    <span className="self-center text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                      {t("common.saving")}
                    </span>
                  ) : null}
                </div>

                <div className="mt-6 border-t border-[var(--line)] pt-5">
                  <p className="text-sm font-semibold text-[var(--text)]">{t("settings.inferredPreferences")}</p>
                  {stylePreferences?.inferred?.length ? (
                    <div className="mt-3 divide-y divide-[var(--line)]">
                      {stylePreferences.inferred.map((entry) => (
                        <div key={entry.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {entry.kind}: {entry.value}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                              {formatInferredPreferenceMetadata(entry, language, t)}{entry.evidence ? ` · ${entry.evidence}` : ""}
                            </p>
                          </div>
                          <button
                            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            disabled={!auth.token || savingStylePreferences}
                            onClick={() => handleRemoveInferredStylePreference(entry.id)}
                          >
                            {t("common.remove")}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {t("settings.noInferredPreferences")}
                    </p>
                  )}
                </div>

                {stylePreferencesError ? (
                  <p className="mt-4 rounded-[1rem] border border-[var(--danger-line)] bg-[var(--danger-surface)] px-3 py-2 text-sm text-[var(--danger)]">
                    {"message" in stylePreferencesError ? stylePreferencesError.message : t(stylePreferencesError.key)}
                  </p>
                ) : null}
            </section>
          </div>
        ) : null}

        {activeSection === "account" ? (
          <div className="max-w-2xl space-y-8 pb-8">
            <div>
              <p className="text-sm font-semibold text-[var(--muted)]">{t("settings.signedInAs")}</p>
              <h3 className="mt-3 text-2xl font-semibold leading-none text-[var(--text)]">
                {auth.user?.display_name}
              </h3>
            </div>
            <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              <div className="grid gap-2 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{t("common.email")}</p>
                <p className="text-sm text-[var(--text)]">{auth.user?.email || t("common.notAvailable")}</p>
              </div>
              <div className="grid gap-2 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{t("settings.memberSince")}</p>
                <p className="text-sm text-[var(--text)]">
                  {auth.user?.created_at ? formatShortDate(auth.user.created_at, language) : t("common.notAvailable")}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function stylePreferencesToDraft(details: StylePreferenceDetails | undefined): StyleDraft {
  const safeDetails = details ?? {
    liked_styles: [],
    disliked_styles: [],
    preferred_colors: [],
    avoided_colors: [],
    preferred_brands: [],
    avoided_brands: [],
    preferred_fits: [],
    occasions: [],
    budget_notes: null,
    sizing_notes: null,
    freeform_notes: null,
  };
  return {
    liked_styles: safeDetails.liked_styles.join(", "),
    disliked_styles: safeDetails.disliked_styles.join(", "),
    preferred_colors: safeDetails.preferred_colors.join(", "),
    avoided_colors: safeDetails.avoided_colors.join(", "),
    preferred_brands: safeDetails.preferred_brands.join(", "),
    avoided_brands: safeDetails.avoided_brands.join(", "),
    preferred_fits: safeDetails.preferred_fits.join(", "),
    occasions: safeDetails.occasions.join(", "),
    budget_notes: safeDetails.budget_notes ?? "",
    sizing_notes: safeDetails.sizing_notes ?? "",
    freeform_notes: safeDetails.freeform_notes ?? "",
  };
}

function formatInferredPreferenceMetadata(
  entry: { confidence: number; occurrence_count: number | null; last_seen_at: string | null; source: string | null },
  language: import("@/lib/i18n").Language,
  t: import("@/lib/i18n").Translator,
) {
  const percent = new Intl.NumberFormat(language, { style: "percent" }).format(entry.confidence);
  const parts = [t("settings.confidence", { value: percent })];
  if (entry.occurrence_count) {
    parts.push(t(entry.occurrence_count === 1 ? "settings.observation.one" : "settings.observation.other", { count: entry.occurrence_count }));
  }
  if (entry.last_seen_at) {
    parts.push(t("settings.lastSeen", { date: formatShortDate(entry.last_seen_at, language) }));
  }
  if (entry.source === "learned") {
    parts.push(t("settings.learnedAutomatically"));
  }
  return parts.join(" · ");
}

function draftToStylePreferences(draft: StyleDraft): StylePreferenceDetails {
  return {
    liked_styles: parseCsv(draft.liked_styles),
    disliked_styles: parseCsv(draft.disliked_styles),
    preferred_colors: parseCsv(draft.preferred_colors),
    avoided_colors: parseCsv(draft.avoided_colors),
    preferred_brands: parseCsv(draft.preferred_brands),
    avoided_brands: parseCsv(draft.avoided_brands),
    preferred_fits: parseCsv(draft.preferred_fits),
    occasions: parseCsv(draft.occasions),
    budget_notes: cleanNote(draft.budget_notes),
    sizing_notes: cleanNote(draft.sizing_notes),
    freeform_notes: cleanNote(draft.freeform_notes),
  };
}

function parseCsv(value: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of value.split(/[;,]/)) {
    const normalized = item.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    values.push(normalized);
    seen.add(key);
  }
  return values;
}

function cleanNote(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
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
      className="option-row flex w-full items-start justify-between gap-4 border-b border-[var(--line)] px-2 py-4 text-left hover:bg-[var(--surface)] hover:text-[var(--text)]"
      type="button"
      onClick={onToggle}
    >
      <div>
        <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
      </div>
      <span
        className={`mt-1 inline-flex h-7 w-12 shrink-0 rounded-full p-1 transition ${checked ? "bg-[var(--accent)]" : "bg-[var(--surface-high)]"}`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-[var(--text)] transition ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}

type SearchPriorityToggleProps = {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onToggle: () => void;
};

function SearchPriorityToggle({
  checked,
  description,
  disabled,
  label,
  onToggle,
}: SearchPriorityToggleProps) {
  return (
    <button
      className={`option-row flex min-h-[5.5rem] items-start gap-3 border-b px-2 py-3 text-left ${
        checked
          ? "border-[rgba(208,188,255,0.42)] bg-[var(--accent-soft)]"
          : "border-[var(--line)] hover:bg-[var(--surface)]"
      } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
    >
      <span
        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.55rem] border ${
          checked
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
            : "border-[var(--line-strong)] bg-[var(--surface-high)] text-transparent"
        }`}
      >
        <Check size={14} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--text)]">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
          {description}
        </span>
      </span>
    </button>
  );
}
