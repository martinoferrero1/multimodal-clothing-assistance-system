"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  MessagesSquare,
  PanelsTopLeft,
  Plus,
  UserRound,
  X,
} from "lucide-react";

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

export type SettingsSection = "general" | "assistant" | "account";
type LocalizedError = { message: string } | { key: MessageKey };
type StyleDraft = {
  liked_styles: string[];
  disliked_styles: string[];
  preferred_colors: string[];
  avoided_colors: string[];
  preferred_brands: string[];
  avoided_brands: string[];
  preferred_fits: string[];
  occasions: string[];
  budget_notes: string;
  sizing_notes: string;
  freeform_notes: string;
};
type ListStylePreferenceKey = {
  [Key in keyof StyleDraft]: StyleDraft[Key] extends string[] ? Key : never;
}[keyof StyleDraft];
type NoteStylePreferenceKey = {
  [Key in keyof StyleDraft]: StyleDraft[Key] extends string ? Key : never;
}[keyof StyleDraft];

type SettingsViewProps = {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
};

const listStyleDraftFields: Array<{ key: ListStylePreferenceKey; labelKey: MessageKey }> = [
  { key: "liked_styles", labelKey: "settings.likedStyles" },
  { key: "disliked_styles", labelKey: "settings.dislikedStyles" },
  { key: "preferred_colors", labelKey: "settings.preferredColors" },
  { key: "avoided_colors", labelKey: "settings.avoidedColors" },
  { key: "preferred_brands", labelKey: "settings.preferredBrands" },
  { key: "avoided_brands", labelKey: "settings.avoidedBrands" },
  { key: "preferred_fits", labelKey: "settings.preferredFits" },
  { key: "occasions", labelKey: "settings.occasions" },
];

const noteStyleDraftFields: Array<{ key: NoteStylePreferenceKey; labelKey: MessageKey }> = [
  { key: "budget_notes", labelKey: "settings.budgetNotes" },
  { key: "sizing_notes", labelKey: "settings.sizingNotes" },
  { key: "freeform_notes", labelKey: "settings.styleNotes" },
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
    if (auth.status !== "authenticated" || savingSearchPreferences) {
      return;
    }

    const nextFields = togglePriorityField(searchPriorityFields, field);
    setOptimisticSearchPriorityFields(nextFields);
    setSavingSearchPreferences(true);
    setSearchPreferencesError(null);

    try {
      await updateUserSearchPreferences(nextFields);
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
    if (auth.status !== "authenticated" || savingStylePreferences || !stylePreferences) {
      return;
    }
    setSavingStylePreferences(true);
    setStylePreferencesError(null);
    try {
      await updateUserStylePreferences({
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
    if (auth.status !== "authenticated" || savingStylePreferences) {
      return;
    }
    setSavingStylePreferences(true);
    setStylePreferencesError(null);
    try {
      await updateUserStylePreferences({ explicit: draftToStylePreferences(styleDraft) });
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
    if (auth.status !== "authenticated" || savingStylePreferences) {
      return;
    }
    setSavingStylePreferences(true);
    setStylePreferencesError(null);
    try {
      await clearUserExplicitStylePreferences();
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
    if (auth.status !== "authenticated" || savingStylePreferences) {
      return;
    }
    setSavingStylePreferences(true);
    setStylePreferencesError(null);
    try {
      await removeUserInferredStylePreference(inferredId);
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
      icon: PanelsTopLeft,
    },
    {
      id: "assistant" as const,
      label: t("sidebar.assistant"),
      icon: MessagesSquare,
    },
    {
      id: "account" as const,
      label: t("workspace.account"),
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
                <span className="block text-sm font-semibold">{section.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="px-5 py-5 sm:px-6 lg:px-8">
        {activeSection === "general" ? (
          <div className="space-y-7 pb-8">
            <div className="space-y-0">
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
          </div>
        ) : null}

        {activeSection === "assistant" ? (
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
                      disabled={savingSearchPreferences || auth.status !== "authenticated"}
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
                    disabled={auth.status !== "authenticated" || savingStylePreferences}
                    aria-pressed={stylePreferences?.use_personalized_styles ?? true}
                    onClick={handlePersonalizedStylesToggle}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-[var(--text)] transition ${stylePreferences?.use_personalized_styles ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                <div className="mt-5 grid items-start gap-3 sm:grid-cols-2">
                  {listStyleDraftFields.map((field) => (
                    <StylePreferencePicker
                      key={field.key}
                      disabled={savingStylePreferences}
                      label={t(field.labelKey)}
                      values={styleDraft[field.key]}
                      onChange={(values) =>
                        setStyleDraft((current) => ({
                          ...current,
                          [field.key]: values,
                        }))
                      }
                    />
                  ))}

                  {noteStyleDraftFields.map((field) => (
                    <label key={field.key} className="sm:col-span-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        {t(field.labelKey)}
                      </span>
                      <textarea
                        className="mt-2 min-h-[3.2rem] w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-sm leading-6 outline-none transition focus:border-[var(--accent)]"
                        rows={3}
                        placeholder={t("settings.addNote")}
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
                    disabled={auth.status !== "authenticated" || savingStylePreferences}
                    onClick={handleSaveExplicitStylePreferences}
                  >
                    {t("settings.saveStyles")}
                  </button>
                  <button
                    className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={auth.status !== "authenticated" || savingStylePreferences}
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
                            disabled={auth.status !== "authenticated" || savingStylePreferences}
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
    liked_styles: [...safeDetails.liked_styles],
    disliked_styles: [...safeDetails.disliked_styles],
    preferred_colors: [...safeDetails.preferred_colors],
    avoided_colors: [...safeDetails.avoided_colors],
    preferred_brands: [...safeDetails.preferred_brands],
    avoided_brands: [...safeDetails.avoided_brands],
    preferred_fits: [...safeDetails.preferred_fits],
    occasions: [...safeDetails.occasions],
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
    liked_styles: normalizePreferenceValues(draft.liked_styles),
    disliked_styles: normalizePreferenceValues(draft.disliked_styles),
    preferred_colors: normalizePreferenceValues(draft.preferred_colors),
    avoided_colors: normalizePreferenceValues(draft.avoided_colors),
    preferred_brands: normalizePreferenceValues(draft.preferred_brands),
    avoided_brands: normalizePreferenceValues(draft.avoided_brands),
    preferred_fits: normalizePreferenceValues(draft.preferred_fits),
    occasions: normalizePreferenceValues(draft.occasions),
    budget_notes: cleanNote(draft.budget_notes),
    sizing_notes: cleanNote(draft.sizing_notes),
    freeform_notes: cleanNote(draft.freeform_notes),
  };
}

function normalizePreferenceValues(items: string[]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of items) {
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

type StylePreferencePickerProps = {
  disabled: boolean;
  label: string;
  onChange: (values: string[]) => void;
  values: string[];
};

function StylePreferencePicker({
  disabled,
  label,
  onChange,
  values,
}: StylePreferencePickerProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const controlId = `style-preference-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  function addPreference() {
    const normalized = draft.trim();
    if (!normalized || values.some((value) => value.toLowerCase() === normalized.toLowerCase())) {
      return;
    }

    onChange([...values, normalized]);
    setDraft("");
  }

  function removePreference(valueToRemove: string) {
    onChange(values.filter((value) => value !== valueToRemove));
  }

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      <div className="mt-2 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] transition focus-within:border-[var(--accent)]">
        <button
          className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          aria-controls={controlId}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <span className={values.length ? "font-semibold" : "text-[var(--muted)]"}>
            {values.length
              ? t(values.length === 1 ? "settings.selectedPreference.one" : "settings.selectedPreference.other", { count: values.length })
              : t("settings.noSelectedPreferences")}
          </span>
          <ChevronDown size={16} className={`shrink-0 text-[var(--muted)] transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open ? (
          <div id={controlId} className="border-t border-[var(--line)] p-3">
            {values.length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {values.map((value) => (
                  <span
                    key={value.toLowerCase()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(208,188,255,0.3)] bg-[var(--accent-soft)] py-1 pl-3 pr-1.5 text-xs font-semibold text-[var(--text)]"
                  >
                    {value}
                    <button
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-white/10 hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                      type="button"
                      aria-label={t("settings.removePreference", { value })}
                      disabled={disabled}
                      onClick={() => removePreference(value)}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface-low)] px-3 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--accent)]"
                type="text"
                value={draft}
                disabled={disabled}
                placeholder={t("settings.preferencePlaceholder")}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPreference();
                  }
                  if (event.key === "Escape") {
                    setOpen(false);
                  }
                }}
              />
              <button
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-[var(--text)] px-3 text-sm font-semibold text-[var(--accent-ink)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={disabled || !draft.trim()}
                onClick={addPreference}
              >
                <Plus size={15} />
                <span className="hidden sm:inline">{t("settings.addPreference")}</span>
              </button>
            </div>
          </div>
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
