import type {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import type {
  CatalogProduct,
  ProductRecommendation,
  OutfitRecommendation,
} from "./core/types";
import type { NavigatorScreenParams } from "@react-navigation/native";
export type TabRoutes = {
  Home: undefined;
  Assistant: undefined;
  Style: undefined;
  Catalog: { query?: string } | undefined;
  More: undefined;
};
export type RootRoutes = {
  Main: NavigatorScreenParams<TabRoutes> | undefined;
  Auth: undefined;
  Settings: undefined;
  Favorites: undefined;
  News: { articleId?: string } | undefined;
  Around: undefined;
  Community: undefined;
  Store: undefined;
  StoreRegister: undefined;
  Chat: { id?: string };
  Product: { product: CatalogProduct | ProductRecommendation };
  Outfit: { outfit: OutfitRecommendation };
};
export type ScreenProps<K extends keyof RootRoutes> = NativeStackScreenProps<
  RootRoutes,
  K
>;
export type Navigation = NativeStackNavigationProp<RootRoutes>;
