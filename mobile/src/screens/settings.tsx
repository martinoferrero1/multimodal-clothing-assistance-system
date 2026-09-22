import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { useApp } from "../core/state";
import * as api from "../core/api";
import type {
  SearchPriorityField,
  StylePreferenceDetails,
} from "../core/types";
import { Button, Chip, Field, Page, confirmDelete } from "../ui/components";
import { colors, s } from "../ui/theme";
import { RequireAccount } from "./auth";
import type { ScreenProps } from "../navigation-types";

export function SettingsScreen({ navigation }: ScreenProps<"Settings">) {
  const { l, preferences, setPreferences, auth, signOut } = useApp();
  const [section, setSection] = useState("general");
  return (
    <Page>
      <Text style={s.title}>{l("Configuración", "Settings")}</Text>
      <View style={s.row}>
        {["general", "assistant", "account"].map((key, i) => (
          <Chip
            key={key}
            title={
              [l("General", "General"), "Assistant", l("Cuenta", "Account")][i]
            }
            selected={section === key}
            onPress={() => setSection(key)}
          />
        ))}
      </View>
      {section === "general" && (
        <View style={s.card}>
          <Text style={s.heading}>
            {l("Idioma de la aplicación", "Application language")}
          </Text>
          <View style={s.row}>
            <Button
              title="Español"
              secondary={preferences.language !== "es"}
              onPress={() => setPreferences({ language: "es" })}
            />
            <Button
              title="English"
              secondary={preferences.language !== "en"}
              onPress={() => setPreferences({ language: "en" })}
            />
          </View>
        </View>
      )}
      {section === "assistant" && (
        <>
          <View style={s.card}>
            <Text style={s.heading}>{l("Diseño del chat", "Chat layout")}</Text>
            <SettingToggle
              label={l("Mensajes compactos", "Compact messages")}
              value={preferences.compactChat}
              onChange={(compactChat) => setPreferences({ compactChat })}
            />
            <SettingToggle
              label={l("Mostrar recomendaciones", "Show recommendations")}
              value={preferences.showRecommendations}
              onChange={(showRecommendations) =>
                setPreferences({ showRecommendations })
              }
            />
            <Text style={s.muted}>
              {l(
                "Los outfits se abren en una pantalla completa.",
                "Outfits open in a full screen view.",
              )}
            </Text>
          </View>
          <RequireAccount>
            <PersonalPreferences />
          </RequireAccount>
        </>
      )}
      {section === "account" &&
        (auth ? (
          <View style={s.card}>
            <Text style={s.heading}>{auth.user.display_name}</Text>
            <Text style={s.muted}>{auth.user.email}</Text>
            <Button
              title={l("Cerrar sesión", "Sign out")}
              secondary
              onPress={async () => {
                await signOut();
                navigation.goBack();
              }}
            />
            <Button
              title={l("Cerrar todas las sesiones", "Sign out everywhere")}
              secondary
              onPress={() =>
                confirmDelete(
                  l("Cerrar todas las sesiones", "Sign out everywhere"),
                  l(
                    "Vas a salir de Lookeate en todos tus dispositivos.",
                    "You will be signed out of Lookeate on all devices.",
                  ),
                  async () => {
                    await signOut(true);
                    navigation.goBack();
                  },
                  l("Cancelar", "Cancel"),
                  l("Cerrar sesiones", "Sign out"),
                )
              }
            />
          </View>
        ) : (
          <Button
            title={l("Ingresar", "Sign in")}
            onPress={() => navigation.navigate("Auth")}
          />
        ))}
    </Page>
  );
}
function SettingToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange(v: boolean): Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const { l } = useApp();
  return (
    <View>
      <View style={s.spread}>
        <Text style={[s.text, { flex: 1 }]}>{label}</Text>
        <Switch
          accessibilityLabel={label}
          disabled={busy}
          value={value}
          trackColor={{ true: colors.accent }}
          onValueChange={async (next) => {
            setBusy(true);
            setError(false);
            try {
              await onChange(next);
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
      {error && (
        <Text style={{ color: colors.danger }}>
          {l("No se pudo guardar.", "Could not save.")}
        </Text>
      )}
    </View>
  );
}
function PersonalPreferences() {
  const { auth, l, t, accept } = useApp();
  const [draft, setDraft] = useState<Partial<StylePreferenceDetails>>(
    auth?.user.style_preferences.explicit ?? {},
  );
  const [priority, setPriority] = useState<SearchPriorityField[]>(
    auth?.user.search_preferences.priority_fields ?? [],
  );
  const [saved, setSaved] = useState(false);
  async function refresh() {
    accept(await api.restoreSession());
  }
  const listFields = [
    { key: "liked_styles", label: t("settings.likedStyles") },
    { key: "disliked_styles", label: t("settings.dislikedStyles") },
    { key: "preferred_colors", label: t("settings.preferredColors") },
    { key: "avoided_colors", label: t("settings.avoidedColors") },
    { key: "preferred_brands", label: t("settings.preferredBrands") },
    { key: "avoided_brands", label: t("settings.avoidedBrands") },
    { key: "preferred_fits", label: t("settings.preferredFits") },
    { key: "occasions", label: t("settings.occasions") },
  ] as const;
  const [listDraft, setListDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(auth?.user.style_preferences.explicit ?? {})
        .filter(([, value]) => Array.isArray(value))
        .map(([key, value]) => [key, (value as string[]).join(", ")]),
    ),
  );
  return (
    <>
      <View style={s.card}>
        <Text style={s.heading}>
          {l("Prioridad de búsqueda", "Search priority")}
        </Text>
        <Text style={s.muted}>
          {l(
            "Tocá en el orden que prefieras. Volvé a tocar para quitar.",
            "Tap in priority order. Tap again to remove.",
          )}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(
            [
              "category",
              "gender",
              "base_colors",
              "secondary_colors",
              "season",
              "max_price",
            ] as const
          ).map((field, i) => (
            <Chip
              key={field}
              title={`${priority.includes(field) ? `${priority.indexOf(field) + 1}. ` : ""}${[t("priority.category"), t("priority.gender"), t("priority.baseColors"), t("priority.secondaryColors"), t("priority.season"), t("priority.maxPrice")][i]}`}
              selected={priority.includes(field)}
              onPress={() =>
                setPriority((v) =>
                  v.includes(field)
                    ? v.filter((f) => f !== field)
                    : [...v, field],
                )
              }
            />
          ))}
        </View>
        <Button
          title={l("Guardar prioridad", "Save priority")}
          onPress={async () => {
            await api.updateUserSearchPreferences(priority);
            await refresh();
          }}
        />
      </View>
      <View style={s.card}>
        <Text style={s.heading}>{l("Memoria de estilo", "Style memory")}</Text>
        <SettingToggle
          label={l(
            "Personalizar mis recomendaciones",
            "Personalize my recommendations",
          )}
          value={auth?.user.style_preferences.use_personalized_styles ?? false}
          onChange={async (value) => {
            await api.updateUserStylePreferences({
              use_personalized_styles: value,
            });
            await refresh();
          }}
        />
        <Text style={s.muted}>
          {l("Separá los valores con comas.", "Separate values with commas.")}
        </Text>
        {listFields.map(({ key, label }) => (
          <Field
            key={key}
            label={label}
            value={listDraft[key] ?? ""}
            onChangeText={(value) => {
              setListDraft((v) => ({ ...v, [key]: value }));
              setSaved(false);
            }}
          />
        ))}
        {(
          [
            { key: "budget_notes", label: t("settings.budgetNotes") },
            { key: "sizing_notes", label: t("settings.sizingNotes") },
            { key: "freeform_notes", label: t("settings.styleNotes") },
          ] as const
        ).map(({ key, label }) => (
          <Field
            key={key}
            label={label}
            value={draft[key] ?? ""}
            onChangeText={(value) => {
              setDraft((v) => ({ ...v, [key]: value }));
              setSaved(false);
            }}
            multiline
          />
        ))}
        <Button
          title={l("Guardar mi estilo", "Save my style")}
          onPress={async () => {
            const explicit = {
              ...draft,
              ...Object.fromEntries(
                Object.entries(listDraft).map(([key, value]) => [
                  key,
                  value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                ]),
              ),
            };
            await api.updateUserStylePreferences({ explicit });
            await refresh();
            setSaved(true);
          }}
        />
        {saved && (
          <Text style={{ color: colors.accent }}>
            {l("Preferencias guardadas.", "Preferences saved.")}
          </Text>
        )}
        <Button
          title={l(
            "Borrar preferencias explícitas",
            "Clear explicit preferences",
          )}
          secondary
          onPress={() =>
            confirmDelete(
              l("Borrar preferencias", "Clear preferences"),
              l(
                "Se borrarán tus preferencias de estilo guardadas.",
                "Your saved explicit style preferences will be cleared.",
              ),
              async () => {
                await api.clearUserExplicitStylePreferences();
                setDraft({});
                setListDraft({});
                await refresh();
              },
              l("Cancelar", "Cancel"),
              l("Borrar", "Clear"),
            )
          }
        />
      </View>
      <View style={s.card}>
        <Text style={s.heading}>
          {l("Lo que aprendimos de vos", "What we learned about you")}
        </Text>
        {auth?.user.style_preferences.inferred.length ? (
          auth.user.style_preferences.inferred.map((item) => (
            <View key={item.id} style={{ gap: 8 }}>
              <Text style={s.text}>{item.value}</Text>
              {item.evidence && <Text style={s.muted}>{item.evidence}</Text>}
              <Button
                title={l("Olvidar", "Forget")}
                secondary
                onPress={async () => {
                  await api.removeUserInferredStylePreference(item.id);
                  await refresh();
                }}
              />
            </View>
          ))
        ) : (
          <Text style={s.muted}>
            {l(
              "Todavía no hay preferencias aprendidas.",
              "No learned preferences yet.",
            )}
          </Text>
        )}
      </View>
    </>
  );
}
