import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "../core/state";
import { fashionNewsArticles } from "../core/fashion-news";
import * as api from "../core/api";
import { useResource } from "../core/use-resource";
import { Button, Chip, Empty, Field, Loading, Page } from "../ui/components";
import { colors, s } from "../ui/theme";
import { RequireAccount } from "./auth";

export async function openExternal(url: string) {
  if (/^https?:\/\//i.test(url)) await Linking.openURL(url);
}
export function NewsScreen() {
  const { l, preferences } = useApp();
  const language = preferences.language;
  const [category, setCategory] = useState("");
  const categories = [
    ...new Set(fashionNewsArticles.map((a) => a.category[language])),
  ];
  return (
    <Page>
      <Text style={s.eyebrow}>
        {l("EL MUNDO DE LA MODA", "THE WORLD OF FASHION")}
      </Text>
      <Text style={s.title}>
        {l("Ideas que\nmarcan el ritmo.", "Ideas that\nset the pace.")}
      </Text>
      <Text style={s.muted}>
        {l(
          "La selección editorial de Lookeate.",
          "The Lookeate editorial selection.",
        )}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip
          title={l("Todo", "All")}
          selected={!category}
          onPress={() => setCategory("")}
        />
        {categories.map((c) => (
          <Chip
            key={c}
            title={c}
            selected={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
      </View>
      {fashionNewsArticles
        .filter((a) => !category || a.category[language] === category)
        .map((article, i) => (
          <View
            key={article.id}
            style={[s.card, { padding: 0, overflow: "hidden" }]}
          >
            <LinearGradient
              colors={i % 2 ? ["#443438", "#252027"] : ["#49335d", "#22212c"]}
              style={{
                padding: 24,
                minHeight: 155,
                justifyContent: "space-between",
              }}
            >
              <Text style={s.eyebrow}>
                {article.category[language].toUpperCase()}
              </Text>
              <Text style={[s.heading, { fontSize: 29 }]}>
                {article.title[language]}
              </Text>
            </LinearGradient>
            <View style={{ padding: 20, gap: 14 }}>
              <Text style={s.muted}>
                {article.source} ·{" "}
                {new Date(`${article.publishedAt}T12:00:00`).toLocaleDateString(
                  language,
                )}
              </Text>
              <Text style={s.text}>{article.summary[language]}</Text>
              <Button
                title={l("Leer en la fuente", "Read at source")}
                secondary
                icon="open-outline"
                onPress={() => openExternal(article.url)}
              />
            </View>
          </View>
        ))}
    </Page>
  );
}
export function CommunityScreen() {
  return (
    <RequireAccount>
      <Community />
    </RequireAccount>
  );
}
function Community() {
  const { l, auth } = useApp();
  const result = useResource(api.listCommunityListings);
  const [code, setCode] = useState("");
  const [filter, setFilter] = useState("all");
  const [joined, setJoined] = useState(false);
  if (auth?.selected_store)
    return (
      <Page>
        <Empty
          title={l(
            "Comunidad para cuentas personales",
            "Community for personal accounts",
          )}
          body={l(
            "Podés administrar los espacios de tu tienda desde Mi tienda.",
            "Manage your store’s spaces from My store.",
          )}
        />
      </Page>
    );
  return (
    <Page>
      <Text style={s.eyebrow}>LOOKEATE COMMUNITY</Text>
      <Text style={s.title}>
        {l("El estilo también\nse comparte.", "Style is better\nshared.")}
      </Text>
      <View style={s.card}>
        <Field
          label={l("Código de invitación", "Invitation code")}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          maxLength={64}
        />
        <Button
          title={l("Unirme", "Join")}
          disabled={!code.trim()}
          onPress={async () => {
            await api.joinCommunityListingByCode(code.trim());
            setCode("");
            setJoined(true);
            await result.reload();
          }}
        />
        {joined && (
          <Text style={{ color: colors.accent }}>
            {l("Ya sos parte del espacio.", "You have joined the space.")}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {["all", "blog", "event", "space", "subscribed"].map((key, i) => (
          <Chip
            key={key}
            title={
              [
                l("Todo", "All"),
                "Blogs",
                l("Eventos", "Events"),
                l("Espacios", "Spaces"),
                l("Mis suscripciones", "My subscriptions"),
              ][i]
            }
            selected={filter === key}
            onPress={() => setFilter(key)}
          />
        ))}
      </View>
      {result.loading && <Loading />}
      {result.error && (
        <Empty
          title={l(
            "No pudimos cargar la comunidad",
            "Could not load community",
          )}
          retry={() => void result.reload()}
        />
      )}
      {result.data
        ?.filter(
          (item) =>
            filter === "all" ||
            (filter === "subscribed"
              ? item.is_subscribed
              : item.kind === filter),
        )
        .map((item) => (
          <View key={item.id} style={s.card}>
            <Text style={s.eyebrow}>
              {item.store_display_name ?? "Lookeate"}
            </Text>
            <Text style={s.heading}>{item.title}</Text>
            {item.description && <Text style={s.text}>{item.description}</Text>}
            {item.location && <Text style={s.muted}>{item.location}</Text>}
            {item.starts_at && (
              <Text style={s.muted}>
                {new Date(item.starts_at).toLocaleString()}
              </Text>
            )}
            <Button
              title={
                item.is_subscribed
                  ? l("Dejar de seguir", "Unsubscribe")
                  : l("Suscribirme", "Subscribe")
              }
              secondary={item.is_subscribed}
              onPress={async () => {
                const value = item.is_subscribed
                  ? await api.unsubscribeFromCommunityListing(item.id)
                  : await api.subscribeToCommunityListing(item.id);
                result.setData(
                  (current) =>
                    current?.map((v) =>
                      v.id === item.id
                        ? { ...v, is_subscribed: value.is_subscribed }
                        : v,
                    ) ?? null,
                );
              }}
            />
            {item.external_url && (
              <Button
                title={l("Abrir enlace", "Open link")}
                secondary
                onPress={() => openExternal(item.external_url!)}
              />
            )}
          </View>
        ))}
      {!result.loading &&
        !result.error &&
        !result.data?.some(
          (item) =>
            filter === "all" ||
            (filter === "subscribed"
              ? item.is_subscribed
              : item.kind === filter),
        ) && (
          <Empty title={l("Todavía no hay publicaciones", "No posts yet")} />
        )}
    </Page>
  );
}
