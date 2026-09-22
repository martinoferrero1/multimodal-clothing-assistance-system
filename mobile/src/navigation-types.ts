import type {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import type {
  CatalogProduct,
  ProductRecommendation,
  OutfitRecommendation,
} from "./core/types";
export type RootRoutes = {
  Main: undefined;
  Auth: undefined;
  Settings: undefined;
  Favorites: undefined;
  News: undefined;
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
