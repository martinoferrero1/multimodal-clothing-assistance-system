import {
  Text,
  View,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../core/state";
import { Button, Page, ScreenHeading } from "../ui/components";
import { colors, s } from "../ui/theme";
import type { Navigation } from "../navigation-types";
import { fashionNewsArticles } from "../core/fashion-news";

function Destination({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[s.card, s.row]}
    >
      <View
        style={{ padding: 12, borderRadius: 16, backgroundColor: colors.soft }}
      >
        <Ionicons name={icon} color={colors.accent} size={23} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[s.text, { fontWeight: "600" }]}>{title}</Text>
        <Text style={s.muted}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" color={colors.muted} size={18} />
    </Pressable>
  );
}
export function HomeScreen({
  openTab,
}: {
  openTab(tab: "Assistant" | "Style" | "Catalog"): void;
}) {
  const { l, t, auth, preferences } = useApp();
  const navigation = useNavigation<Navigation>();
  const { width } = useWindowDimensions();
  return (
    <Page>
      <View style={s.spread}>
        <Text style={s.eyebrow}>
          {l("TU ESTILO, A TU MANERA", "YOUR STYLE, YOUR WAY")}
        </Text>
        <Text
          style={{
            color: colors.accent,
            fontSize: 10,
            padding: 7,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 10,
          }}
        >
          BETA
        </Text>
      </View>
      <View style={{ gap: 12, paddingVertical: 8 }}>
        <Text
          accessibilityRole="header"
          style={[
            s.title,
            {
              fontSize: width < 360 ? 39 : 46,
              lineHeight: width < 360 ? 43 : 50,
            },
          ]}
        >
          {l(
            "Imaginalo. Combinalo.\nHacelo tuyo.",
            "Imagine it. Combine it.\nMake it yours.",
          )}
        </Text>
        <Text style={s.muted}>{t("home.description")}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lookeate Assistant"
        onPress={() => openTab("Assistant")}
      >
        <LinearGradient
          colors={["#241c30", "#493463"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.card, { borderColor: "#74558e", gap: 18, padding: 22 }]}
        >
          <View style={s.spread}>
            <Ionicons name="sparkles-outline" size={26} color={colors.accent} />
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </View>
          <Text style={[s.title, { fontSize: 34, lineHeight: 38 }]}>
            Lookeate Assistant
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
        </LinearGradient>
      </Pressable>
      <Text style={s.eyebrow}>
        {l("EXPLORÁ LAS POSIBILIDADES", "EXPLORE THE POSSIBILITIES")}
      </Text>
      <Destination
        title={l("Creá tu estilo", "Create your style")}
        description={l(
          "Tu guardarropa, tus combinaciones.",
          "Your wardrobe, your combinations.",
        )}
        icon="color-palette-outline"
        onPress={() => openTab("Style")}
      />
      <Destination
        title={l("Catálogo", "Catalog")}
        description={l(
          "Encontrá tu próxima pieza favorita.",
          "Find your next favorite piece.",
        )}
        icon="search-outline"
        onPress={() => openTab("Catalog")}
      />
      <View
        style={[s.card, s.spread]}
        accessibilityLabel={l(
          "Creador de prendas. Próximamente",
          "Garment creator. Coming soon",
        )}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.text}>
            {l("Creador de prendas", "Garment creator")}
          </Text>
          <Text style={s.muted}>{l("Próximamente", "Coming soon")}</Text>
        </View>
        <Ionicons name="lock-closed-outline" color={colors.muted} size={20} />
      </View>
      {auth?.selected_store && (
        <Destination
          title={l("Mi tienda", "My store")}
          description={l(
            "Inventario, publicaciones y estado.",
            "Inventory, listings and status.",
          )}
          icon="storefront-outline"
          onPress={() => navigation.navigate("Store")}
        />
      )}
      <View style={s.divider} />
      <ScreenHeading
        title={l("El mundo de la moda", "The world of fashion")}
        eyebrow={l("EN LA MIRADA", "IN FOCUS")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {fashionNewsArticles
          .filter((article) => article.homeFeature)
          .map((article) => (
            <Pressable
              key={article.id}
              accessibilityRole="button"
              accessibilityLabel={article.title[preferences.language]}
              onPress={() =>
                navigation.navigate("News", { articleId: article.id })
              }
              style={[
                s.card,
                {
                  width: Math.min(width - 56, 300),
                  justifyContent: "space-between",
                  backgroundColor: colors.soft,
                },
              ]}
            >
              <Text style={s.eyebrow}>
                {article.category[preferences.language]}
              </Text>
              <Text style={s.heading}>
                {article.title[preferences.language]}
              </Text>
              <Text style={s.muted}>{article.source} ↗</Text>
            </Pressable>
          ))}
      </ScrollView>
      <Button
        title={l("Ver todas las noticias", "See all stories")}
        secondary
        onPress={() => navigation.navigate("News")}
      />
      <Destination
        title="Lookeate Around"
        description={l(
          "Explorá estilos de Argentina y Estados Unidos.",
          "Explore styles across Argentina and the United States.",
        )}
        icon="globe-outline"
        onPress={() => navigation.navigate("Around")}
      />
      <Destination
        title={l("Comunidad", "Community")}
        description={l(
          "Blogs, eventos y espacios para compartir.",
          "Blogs, events and spaces to share.",
        )}
        icon="people-outline"
        onPress={() => navigation.navigate("Community")}
      />
      <View style={{ gap: 10, paddingVertical: 20 }}>
        <Text style={s.heading}>
          {l("Lookeate está en Beta.", "Lookeate is in Beta.")}
        </Text>
        <Text style={s.muted}>
          {l(
            "Estamos construyendo nuevas formas de explorar tu estilo.",
            "We are building new ways to explore your style.",
          )}
        </Text>
      </View>
    </Page>
  );
}
export function MoreScreen() {
  const { l, auth, favorites } = useApp();
  const navigation = useNavigation<Navigation>();
  return (
    <Page>
      <ScreenHeading
        title={auth?.user.display_name ?? l("Tu espacio", "Your space")}
        eyebrow="LOOKEATE"
        description={l(
          "Todo lo que te inspira, en un lugar.",
          "Everything that inspires you, in one place.",
        )}
      />
      <Text style={s.eyebrow}>
        {l("DESCUBRÍ Y GUARDÁ", "DISCOVER AND SAVE")}
      </Text>
      <Destination
        title={l("Mis favoritos", "My favorites")}
        description={
          favorites.length + " " + l("prendas guardadas", "saved pieces")
        }
        icon="heart-outline"
        onPress={() => navigation.navigate("Favorites")}
      />
      <Destination
        title={l("Noticias de moda", "Fashion news")}
        description={l(
          "La selección editorial de Lookeate.",
          "The Lookeate editorial selection.",
        )}
        icon="newspaper-outline"
        onPress={() => navigation.navigate("News")}
      />
      <Destination
        title="Lookeate Around"
        description={l(
          "Inspiración por provincia y estado.",
          "Inspiration by province and state.",
        )}
        icon="globe-outline"
        onPress={() => navigation.navigate("Around")}
      />
      <Destination
        title={l("Comunidad", "Community")}
        description={l(
          "Blogs, eventos y espacios.",
          "Blogs, events and spaces.",
        )}
        icon="people-outline"
        onPress={() => navigation.navigate("Community")}
      />
      <Text style={s.eyebrow}>{l("TU CUENTA", "YOUR ACCOUNT")}</Text>
      <Destination
        title={l("Configuración", "Settings")}
        description={l(
          "Idioma, Assistant y cuenta.",
          "Language, Assistant and account.",
        )}
        icon="settings-outline"
        onPress={() => navigation.navigate("Settings")}
      />
      {auth?.selected_store ? (
        <Destination
          title={l("Mi tienda", "My store")}
          description={l(
            "Inventario, publicaciones y seguridad.",
            "Inventory, listings and security.",
          )}
          icon="storefront-outline"
          onPress={() => navigation.navigate("Store")}
        />
      ) : (
        !auth && (
          <Destination
            title={l("Registrar tienda", "Register store")}
            description={l(
              "Sumá tu negocio a Lookeate.",
              "Bring your business to Lookeate.",
            )}
            icon="storefront-outline"
            onPress={() => navigation.navigate("StoreRegister")}
          />
        )
      )}
      {!auth && (
        <Button
          title={l("Ingresar", "Sign in")}
          onPress={() => navigation.navigate("Auth")}
        />
      )}
    </Page>
  );
}
