import { Text, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../core/state";
import { Button, Page } from "../ui/components";
import { colors, s } from "../ui/theme";
import type { Navigation } from "../navigation-types";
import { fashionNewsArticles } from "../core/fashion-news";

export function HomeScreen({
  openTab,
}: {
  openTab(tab: "Assistant" | "Style" | "Catalog"): void;
}) {
  const { l, t, auth, preferences } = useApp();
  const navigation = useNavigation<Navigation>();
  return (
    <Page>
      <View style={s.spread}>
        <Text style={s.eyebrow}>
          {l("TU ESTILO, A TU MANERA", "YOUR STYLE, YOUR WAY")}
        </Text>
        <View
          style={[
            s.chip,
            { minHeight: 30, paddingVertical: 5, borderColor: colors.accent },
          ]}
        >
          <Text style={{ color: colors.accent, fontSize: 11 }}>BETA</Text>
        </View>
      </View>
      <Text style={[s.title, { fontSize: 46, lineHeight: 49, marginTop: 10 }]}>
        {l(
          "Imaginalo.\nCombinalo.\nHacelo tuyo.",
          "Imagine it.\nCombine it.\nMake it yours.",
        )}
      </Text>
      <Text style={[s.muted, { maxWidth: 400 }]}>{t("home.description")}</Text>
      {auth?.selected_store && (
        <Button
          title={l("Mi tienda", "My store")}
          icon="storefront-outline"
          secondary
          onPress={() => navigation.navigate("Store")}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lookeate Assistant"
        onPress={() => openTab("Assistant")}
      >
        <LinearGradient
          colors={["#221a2d", "#4a3566"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            s.card,
            {
              minHeight: 290,
              justifyContent: "space-between",
              borderColor: "#74558e",
            },
          ]}
        >
          <View style={s.spread}>
            <Ionicons name="sparkles-outline" size={30} color={colors.accent} />
            <Ionicons
              name="arrow-up-outline"
              size={24}
              style={{ transform: [{ rotate: "45deg" }] }}
              color={colors.text}
            />
          </View>
          <View style={{ gap: 14 }}>
            <Text style={[s.title, { fontSize: 38 }]}>
              Lookeate{"\n"}Assistant
            </Text>
            <Text style={s.text}>
              {l(
                "Un poco de inspiración. Un look muy vos.",
                "A little inspiration. A look that is all you.",
              )}
            </Text>
            <Text style={{ color: colors.accent, fontWeight: "700" }}>
              {l("Empezar una conversación", "Start a conversation")} →
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
      <Text style={s.eyebrow}>
        {l("EXPLORÁ LAS POSIBILIDADES", "EXPLORE THE POSSIBILITIES")}
      </Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {(
          [
            {
              tab: "Style",
              icon: "color-palette-outline",
              title: l("Creá tu estilo", "Create your style"),
              text: l("Combiná prendas.", "Combine pieces."),
            },
            {
              tab: "Catalog",
              icon: "search-outline",
              title: l("Catálogo", "Catalog"),
              text: l("Encontrá tu próxima pieza.", "Find your next piece."),
            },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.tab}
            accessibilityRole="button"
            onPress={() => openTab(item.tab)}
            style={[s.card, { flex: 1, padding: 16, minHeight: 185 }]}
          >
            <Ionicons name={item.icon} color={colors.accent} size={25} />
            <Text style={s.heading}>{item.title}</Text>
            <Text style={s.muted}>{item.text}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[s.card, { opacity: 0.65 }]}>
        <View style={s.spread}>
          <Text style={s.heading}>
            {l("Creador de prendas", "Garment creator")}
          </Text>
          <Ionicons name="lock-closed-outline" color={colors.muted} size={18} />
        </View>
        <Text style={s.muted}>{l("Próximamente", "Coming soon")}</Text>
      </View>
      <View style={s.divider} />
      <Text style={s.heading}>
        {l("El mundo de la moda", "The world of fashion")}
      </Text>
      <Text style={s.muted}>
        {fashionNewsArticles[0].title[preferences.language]}
      </Text>
      <Button
        title={l("Ver noticias", "Read stories")}
        secondary
        onPress={() => navigation.navigate("News")}
      />
      <Text style={[s.muted, { fontSize: 12 }]}>
        {l(
          "Lookeate está en Beta. Estamos construyendo nuevas formas de explorar tu estilo.",
          "Lookeate is in Beta. We are building new ways to explore your style.",
        )}
      </Text>
    </Page>
  );
}
export function MoreScreen() {
  const { l, auth } = useApp();
  const navigation = useNavigation<Navigation>();
  const links = [
    {
      route: "Favorites",
      label: l("Mis favoritos", "My favorites"),
      icon: "heart-outline",
    },
    {
      route: "News",
      label: l("Noticias de moda", "Fashion news"),
      icon: "newspaper-outline",
    },
    {
      route: "Community",
      label: l("Comunidad", "Community"),
      icon: "people-outline",
    },
    {
      route: "Settings",
      label: l("Configuración", "Settings"),
      icon: "settings-outline",
    },
    {
      route: auth?.selected_store ? "Store" : "StoreRegister",
      label: auth?.selected_store
        ? l("Mi tienda", "My store")
        : l("Registrar tienda", "Register store"),
      icon: "storefront-outline",
    },
  ] as const;
  return (
    <Page>
      <Text style={s.eyebrow}>LOOKEATE</Text>
      <Text style={s.title}>
        {auth?.user.display_name ?? l("Tu espacio", "Your space")}
      </Text>
      <Text style={s.muted}>
        {l(
          "Todo lo que te inspira, en un lugar.",
          "Everything that inspires you, in one place.",
        )}
      </Text>
      {links.map((item) => (
        <Pressable
          key={item.route}
          accessibilityRole="button"
          onPress={() => navigation.navigate(item.route)}
          style={[s.card, s.spread]}
        >
          <View style={s.row}>
            <Ionicons name={item.icon} color={colors.accent} size={23} />
            <Text style={s.text}>{item.label}</Text>
          </View>
          <Ionicons name="chevron-forward" color={colors.muted} size={19} />
        </Pressable>
      ))}
      {!auth && (
        <Button
          title={l("Ingresar", "Sign in")}
          onPress={() => navigation.navigate("Auth")}
        />
      )}
    </Page>
  );
}
