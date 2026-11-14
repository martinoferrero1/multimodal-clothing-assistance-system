import { useState } from "react";
import { Linking, Text, View, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "../core/state";
import { fashionNewsArticles } from "../core/fashion-news";
import * as api from "../core/api";
import { useResource } from "../core/use-resource";
import {
  Button,
  Chip,
  Empty,
  Field,
  Loading,
  Page,
  Sheet,
} from "../ui/components";
import type { ScreenProps } from "../navigation-types";
import { colors, s } from "../ui/theme";
import { RequireAccount } from "./auth";

export async function openExternal(url: string) {
  if (/^https?:\/\//i.test(url)) await Linking.openURL(url);
}
export function NewsScreen({ route }: ScreenProps<"News">) {
  const { l, preferences } = useApp();
  const language = preferences.language;
  const [category, setCategory] = useState("");
  const [articleId, setArticleId] = useState(route.params?.articleId);
  const selectedArticle = fashionNewsArticles.find(
    (article) => article.id === articleId,
  );
  const categories = [
    ...new Set(fashionNewsArticles.map((a) => a.category.en)),
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        <Chip
          title={l("Todo", "All")}
          selected={!category}
          onPress={() => setCategory("")}
        />
        {categories.map((c) => (
          <Chip
            key={c}
            title={
              fashionNewsArticles.find((article) => article.category.en === c)!
                .category[language]
            }
            selected={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
      </ScrollView>
      <Sheet
        title={l("En la mirada", "In focus")}
        visible={!!selectedArticle}
        onClose={() => setArticleId(undefined)}
      >
        {selectedArticle && (
          <>
            <Text style={s.eyebrow}>{selectedArticle.category[language]}</Text>
            <Text style={s.title}>{selectedArticle.title[language]}</Text>
            <Text style={s.muted}>{selectedArticle.source}</Text>
            <Text style={s.text}>{selectedArticle.summary[language]}</Text>
            <Button
              title={l("Leer en la fuente", "Read at source")}
              onPress={() => openExternal(selectedArticle.url)}
            />
          </>
        )}
      </Sheet>
      {fashionNewsArticles
        .filter((a) => !category || a.category.en === category)
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
  const { l, auth, preferences } = useApp();
  const result = useResource(api.listCommunityListings);
  const [code, setCode] = useState("");
  const [filter, setFilter] = useState("all");
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [query, setQuery] = useState("");
  const visible = result.data?.filter(
    (item) =>
      (filter === "all" ||
        (filter === "subscribed"
          ? item.is_subscribed
          : item.kind === filter)) &&
      [
        item.title,
        item.description,
        item.location,
        item.store_display_name,
        item.store_handle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
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
      <Field
        label={l("Buscar en comunidad", "Search community")}
        value={query}
        onChangeText={setQuery}
        placeholder={l(
          "Tiendas, publicaciones o lugares",
          "Stores, posts or places",
        )}
      />
      <Button
        title={l("Tengo una invitación", "I have an invitation")}
        icon="key-outline"
        secondary
        onPress={() => setJoining(true)}
      />
      {joined && (
        <Text style={{ color: colors.accent }}>
          {l("Ya sos parte del espacio.", "You have joined the space.")}
        </Text>
      )}
      <Sheet
        title={l("Unirme con invitación", "Join by invitation")}
        visible={joining}
        onClose={() => setJoining(false)}
      >
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
            setJoining(false);
            await result.reload();
          }}
        />
      </Sheet>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
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
      </ScrollView>
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
      {visible?.map((item) => (
        <View key={item.id} style={s.card}>
          <Text style={s.eyebrow}>
            {item.store_display_name ?? "Lookeate"} ·{" "}
            {item.kind === "event"
              ? l("Evento", "Event")
              : item.kind === "space"
                ? l("Espacio", "Space")
                : "Blog"}
          </Text>
          <Text style={s.heading}>{item.title}</Text>
          {item.description && <Text style={s.text}>{item.description}</Text>}
          {item.location && <Text style={s.muted}>{item.location}</Text>}
          {item.starts_at && (
            <Text style={s.muted}>
              {new Date(item.starts_at).toLocaleString(
                preferences.language === "es" ? "es-AR" : "en-US",
                { dateStyle: "medium", timeStyle: "short" },
              )}
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
      {!result.loading && !result.error && !visible?.length && (
        <Empty title={l("Todavía no hay publicaciones", "No posts yet")} />
      )}
    </Page>
  );
}
