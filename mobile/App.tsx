import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, View } from "react-native";
import { AppProvider, useApp } from "./src/core/state";
import { colors, s, serif } from "./src/ui/theme";
import { HomeScreen, MoreScreen } from "./src/screens/home";
import { AuthScreen } from "./src/screens/auth";
import { AssistantScreen, ChatScreen } from "./src/screens/chat";
import { StyleScreen } from "./src/screens/style";
import {
  CatalogScreen,
  FavoritesScreen,
  OutfitScreen,
  ProductScreen,
} from "./src/screens/products";
import { CommunityScreen, NewsScreen } from "./src/screens/community";
import { SettingsScreen } from "./src/screens/settings";
import { StoreRegisterScreen, StoreScreen } from "./src/screens/store";
import type { RootRoutes, ScreenProps } from "./src/navigation-types";

const Stack = createNativeStackNavigator<RootRoutes>();
type Tabs = {
  Home: undefined;
  Assistant: undefined;
  Style: undefined;
  Catalog: undefined;
  More: undefined;
};
const Tab = createBottomTabNavigator<Tabs>();
const icons = {
  Home: "home-outline",
  Assistant: "chatbubble-ellipses-outline",
  Style: "shirt-outline",
  Catalog: "search-outline",
  More: "grid-outline",
} as const;
function Main({ navigation }: ScreenProps<"Main">) {
  const { l } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitle: () => (
          <Text
            style={{
              color: colors.text,
              fontFamily: serif,
              fontSize: 29,
              letterSpacing: -1,
            }}
          >
            Lookeate
          </Text>
        ),
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l("Configuración", "Settings")}
            onPress={() => navigation.navigate("Settings")}
            style={{ padding: 14 }}
          >
            <Ionicons name="options-outline" size={22} color={colors.text} />
          </Pressable>
        ),
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#181618",
          borderTopColor: colors.line,
          height: 62 + Math.max(insets.bottom, 8),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 10, marginTop: 3 },
        tabBarIcon: ({ color, size, focused }) => (
          <View
            style={{
              backgroundColor: focused ? colors.soft : "transparent",
              paddingHorizontal: 17,
              paddingVertical: 3,
              borderRadius: 18,
            }}
          >
            <Ionicons name={icons[route.name]} size={size - 2} color={color} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" options={{ title: l("Inicio", "Home") }}>
        {({ navigation: tabNavigation }) => (
          <HomeScreen openTab={(tab) => tabNavigation.navigate(tab)} />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{ title: "Assistant" }}
      />
      <Tab.Screen
        name="Style"
        component={StyleScreen}
        options={{ title: l("Crear estilo", "Style") }}
      />
      <Tab.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{ title: l("Catálogo", "Catalog") }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ title: l("Más", "More") }}
      />
    </Tab.Navigator>
  );
}
function Navigator() {
  const { l, auth } = useApp();
  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.bg,
          card: colors.bg,
          text: colors.text,
          primary: colors.accent,
          border: colors.line,
        },
      }}
    >
      <Stack.Navigator
        key={auth?.user.id ?? "anonymous"}
        screenOptions={{
          contentStyle: s.fill,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen
          name="Main"
          component={Main}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ title: "Lookeate Assistant" }}
        />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{
            title: l("Mi cuenta", "My account"),
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: l("Configuración", "Settings"),
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="Favorites"
          component={FavoritesScreen}
          options={{ title: l("Favoritos", "Favorites") }}
        />
        <Stack.Screen
          name="News"
          component={NewsScreen}
          options={{ title: l("Noticias", "News") }}
        />
        <Stack.Screen
          name="Community"
          component={CommunityScreen}
          options={{ title: l("Comunidad", "Community") }}
        />
        <Stack.Screen
          name="Store"
          component={StoreScreen}
          options={{ title: l("Mi tienda", "My store") }}
        />
        <Stack.Screen
          name="StoreRegister"
          component={StoreRegisterScreen}
          options={{ title: l("Registrar tienda", "Register store") }}
        />
        <Stack.Screen
          name="Product"
          component={ProductScreen}
          options={{
            title: l("La prenda", "The piece"),
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="Outfit"
          component={OutfitScreen}
          options={{ title: l("Tu look", "Your look"), presentation: "modal" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <Navigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
