"use client";

import { useEffect, useState } from "react";
import { Check, PanelsTopLeft, UserRound } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
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

export type SettingsSection = "general" | "account";
type StyleDraft = Record<keyof StylePreferenceDetails, string>;

type SettingsViewProps = {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
};

const styleDraftFields: Array<{ key: keyof StylePreferenceDetails; label: string; multiline?: boolean }> = [
  { key: "liked_styles", label: "Liked styles" },
  { key: "disliked_styles", label: "Styles to avoid" },
  { key: "preferred_colors", label: "Preferred colors" },
  { key: "avoided_colors", label: "Colors to avoid" },
  { key: "preferred_brands", label: "Preferred brands" },
  { key: "avoided_brands", label: "Brands to avoid" },
  { key: "preferred_fits", label: "Preferred fits" },
  { key: "occasions", label: "Occasions" },
  { key: "budget_notes", label: "Budget notes", multiline: true },
  { key: "sizing_notes", label: "Sizing notes", multiline: true },
  { key: "freeform_notes", label: "Style notes", multiline: true },
];

export function SettingsView({ activeSection, onSectionChange }: SettingsViewProps) {
  const auth = useAuth();
  const authPriorityFields = auth.user?.search_preferences?.priority_fields ?? [];
  const [preferences, setPreferences] = useState<SettingsPreferences>(() => readPreferences());
  const [optimisticSearchPriorityFields, setOptimisticSearchPriorityFields] =
    useState<SearchPriorityField[] | null>(null);
  const [savingSearchPreferences, setSavingSearchPreferences] = useState(false);
  const [searchPreferencesError, setSearchPreferencesError] = useState<string | null>(null);
  const [styleDraft, setStyleDraft] = useState<StyleDraft>(() => stylePreferencesToDraft(auth.user?.style_preferences?.explicit));
  const [savingStylePreferences, setSavingStylePreferences] = useState(false);
  const [stylePreferencesError, setStylePreferencesError] = useState<string | null>(null);
  const searchPriorityFields = optimisticSearchPriorityFields ?? authPriorityFields;
  const stylePreferences = auth.user?.style_preferences;

  useEffect(() => {
    queueMicrotask(() => {
      setStyleDraft(stylePreferencesToDraft(auth.user?.style_preferences?.explicit));
    });
  }, [auth.user?.style_preferences?.explicit]);

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
        caughtError instanceof ApiError
          ? caughtError.message
          : "We could not save the search priorities.",
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
        caughtError instanceof ApiError
          ? caughtError.message
          : "We could not update personalized style usage.",
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
        caughtError instanceof ApiError
          ? caughtError.message
          : "We could not save your style preferences.",
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
        caughtError instanceof ApiError
          ? caughtError.message
          : "We could not clear your style preferences.",
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
        caughtError instanceof ApiError
          ? caughtError.message
          : "We could not remove the inferred preference.",
      );
    } finally {
      setSavingStylePreferences(false);
    }
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
    <div className="grid min-h-full lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="h-fit self-start px-3 py-4 lg:sticky lg:top-0 lg:border-r lg:border-[var(--line)]">
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;

            return (
              <button
                key={section.id}
                className={`flex w-full items-start gap-3 border-l-2 px-3 py-3 text-left transition ${
                  active
                    ? "border-[var(--accent)] text-[var(--text)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
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

            <section className="border-b border-[var(--line)] pb-7">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">Search priorities</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {formatPriorityFields(searchPriorityFields)}
                    </p>
                  </div>
                  {savingSearchPreferences ? (
                    <span className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                      Saving
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {SEARCH_PRIORITY_OPTIONS.map((option) => (
                    <SearchPriorityToggle
                      key={option.field}
                      checked={searchPriorityFields.includes(option.field)}
                      disabled={savingSearchPreferences || !auth.token}
                      description={option.description}
                      label={option.label}
                      onToggle={() => handleSearchPriorityToggle(option.field)}
                    />
                  ))}
                </div>

                {searchPreferencesError ? (
                  <p className="mt-4 rounded-[1rem] bg-[rgba(255,234,229,0.8)] px-3 py-2 text-sm text-[#8c2616]">
                    {searchPreferencesError}
                  </p>
                ) : null}
            </section>

            <section className="pb-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">Personalized style memory</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      Let recommendations use your saved and inferred style preferences when your current request does not conflict.
                    </p>
                  </div>
                  <button
                    className={`mt-1 inline-flex h-7 w-12 shrink-0 rounded-full p-1 transition ${stylePreferences?.use_personalized_styles ? "bg-[var(--accent)]" : "bg-[rgba(143,79,43,0.18)]"}`}
                    type="button"
                    disabled={!auth.token || savingStylePreferences}
                    aria-pressed={stylePreferences?.use_personalized_styles ?? true}
                    onClick={handlePersonalizedStylesToggle}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white transition ${stylePreferences?.use_personalized_styles ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {styleDraftFields.map((field) => (
                    <label key={field.key} className={field.multiline ? "sm:col-span-2" : ""}>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        {field.label}
                      </span>
                      <textarea
                        className="mt-2 min-h-[3.2rem] w-full resize-y rounded-[1rem] border border-[var(--line)] bg-white/70 px-3 py-3 text-sm leading-6 outline-none transition focus:border-[var(--accent)]"
                        rows={field.multiline ? 3 : 1}
                        placeholder={field.multiline ? "Add a note" : "Comma-separated values"}
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
                    className="rounded-full bg-[var(--text)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={!auth.token || savingStylePreferences}
                    onClick={handleSaveExplicitStylePreferences}
                  >
                    Save style preferences
                  </button>
                  <button
                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={!auth.token || savingStylePreferences}
                    onClick={handleClearExplicitStylePreferences}
                  >
                    Clear explicit preferences
                  </button>
                  {savingStylePreferences ? (
                    <span className="self-center text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                      Saving
                    </span>
                  ) : null}
                </div>

                <div className="mt-6 border-t border-[var(--line)] pt-5">
                  <p className="text-sm font-semibold text-[var(--text)]">Inferred preferences</p>
                  {stylePreferences?.inferred?.length ? (
                    <div className="mt-3 divide-y divide-[var(--line)]">
                      {stylePreferences.inferred.map((entry) => (
                        <div key={entry.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {entry.kind}: {entry.value}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                              {formatInferredPreferenceMetadata(entry)}{entry.evidence ? ` · ${entry.evidence}` : ""}
                            </p>
                          </div>
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            disabled={!auth.token || savingStylePreferences}
                            onClick={() => handleRemoveInferredStylePreference(entry.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      No inferred style preferences yet.
                    </p>
                  )}
                </div>

                {stylePreferencesError ? (
                  <p className="mt-4 rounded-[1rem] bg-[rgba(255,234,229,0.8)] px-3 py-2 text-sm text-[#8c2616]">
                    {stylePreferencesError}
                  </p>
                ) : null}
            </section>
          </div>
        ) : null}

        {activeSection === "account" ? (
          <div className="max-w-2xl space-y-8 pb-8">
            <div>
              <p className="text-sm font-semibold text-[var(--muted)]">Signed in as</p>
              <h3 className="mt-3 text-2xl font-semibold leading-none text-[var(--text)]">
                {auth.user?.display_name}
              </h3>
            </div>
            <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              <div className="grid gap-2 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Email</p>
                <p className="text-sm text-[var(--text)]">{auth.user?.email || "Not available"}</p>
              </div>
              <div className="grid gap-2 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Member since</p>
                <p className="text-sm text-[var(--text)]">
                  {auth.user?.created_at ? formatShortDate(auth.user.created_at) : "Not available"}
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

function formatInferredPreferenceMetadata(entry: { confidence: number; occurrence_count: number | null; last_seen_at: string | null; source: string | null }) {
  const parts = [`${Math.round(entry.confidence * 100)}% confidence`];
  if (entry.occurrence_count) {
    parts.push(`${entry.occurrence_count} observation${entry.occurrence_count === 1 ? "" : "s"}`);
  }
  if (entry.last_seen_at) {
    parts.push(`last seen ${formatShortDate(entry.last_seen_at)}`);
  }
  if (entry.source === "learned") {
    parts.push("learned automatically");
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
      className="flex w-full items-start justify-between gap-4 border-b border-[var(--line)] py-4 text-left transition hover:text-[var(--text)]"
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
      className={`flex min-h-[5.5rem] items-start gap-3 border-b px-0 py-3 text-left transition ${
        checked
          ? "border-[rgba(143,79,43,0.34)]"
          : "border-[var(--line)]"
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
            : "border-[var(--line-strong)] bg-white/70 text-transparent"
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
