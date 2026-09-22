import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useApp } from "../core/state";
import * as api from "../core/api";
import { useResource } from "../core/use-resource";
import type {
  CatalogProduct,
  ProductRecommendation,
  CatalogQuery,
} from "../core/types";
import {
  Button,
  Chip,
  Empty,
  Field,
  Loading,
  Page,
  Photo,
} from "../ui/components";
import { colors, s } from "../ui/theme";
import { RequireAccount } from "./auth";
import type { Navigation, ScreenProps } from "../navigation-types";

export function imageFor(product: CatalogProduct | ProductRecommendation) {
  return (
    product.images.default ||
    product.images.front ||
    product.images.search ||
    Object.values(product.images).find(Boolean)
  );
}
export function ProductCard({
  product,
}: {
  product: CatalogProduct | ProductRecommendation;
}) {
  const navigation = useNavigation<Navigation>();
  const { l } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={product.product_display_name}
      onPress={() => navigation.navigate("Product", { product })}
      style={[s.card, { flex: 1, padding: 10, gap: 7 }]}
    >
      <Photo key={imageFor(product)} uri={imageFor(product)} />
      <Text style={[s.muted, { fontSize: 11 }]}>
        {product.brand ?? l("SELECCIÓN LOOKEATE", "LOOKEATE SELECTION")}
      </Text>
      <Text
        numberOfLines={2}
        style={[s.text, { fontSize: 14, lineHeight: 20 }]}
      >
        {product.product_display_name}
      </Text>
      <Text style={{ color: colors.accent }}>
        {product.price === null
          ? l("Precio no disponible", "Price unavailable")
          : `$ ${product.price.toLocaleString()}`}
      </Text>
    </Pressable>
  );
}
export function CatalogScreen() {
  return (
    <RequireAccount>
      <Catalog />
    </RequireAccount>
  );
}
function Catalog() {
  const { l } = useApp();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CatalogQuery>({});
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [paging, setPaging] = useState(false);
  const generation = useRef(0);
  const meta = useResource(api.getCatalogMeta);
  const loader = useCallback(() => {
    generation.current++;
    return photo
      ? api.searchCatalogByImage([photo])
      : api.listCatalogProducts(filters);
  }, [filters, photo]);
  const result = useResource(loader);
  async function more() {
    if (paging || !result.data?.has_more) return;
    setPaging(true);
    const current = generation.current;
    try {
      const next = photo
        ? await api.searchCatalogByImage([photo], result.data.items.length)
        : await api.listCatalogProducts({
            ...filters,
            offset: result.data.items.length,
          });
      if (current === generation.current)
        result.setData((previous) =>
          previous
            ? { ...next, items: [...previous.items, ...next.items] }
            : next,
        );
    } finally {
      setPaging(false);
    }
  }
  return (
    <FlatList
      style={s.fill}
      contentContainerStyle={s.page}
      data={result.data?.items ?? []}
      numColumns={2}
      columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
      keyExtractor={(p) => String(p.id)}
      renderItem={({ item }) => <ProductCard product={item} />}
      refreshing={result.loading}
      onRefresh={() => void result.reload()}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <Text style={s.title}>
            {l(
              "Encontrá tu próxima\npieza favorita.",
              "Find your next\nfavorite piece.",
            )}
          </Text>
          <Field
            label={l("Buscar prendas o marcas", "Search pieces or brands")}
            value={query}
            maxLength={160}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              setPhoto(null);
              setFilters((v) => ({ ...v, query }));
            }}
          />
          <Button
            title={l("Buscar", "Search")}
            icon="search-outline"
            onPress={() => {
              setPhoto(null);
              setFilters((v) => ({ ...v, query }));
            }}
          />
          <Button
            title={l("Buscar con una foto", "Search with a photo")}
            secondary
            icon="camera-outline"
            onPress={async () => {
              const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.8,
              });
              if (!picked.canceled) setPhoto(picked.assets[0]);
            }}
          />
          {photo ? (
            <>
              <Photo uri={photo.uri} size={100} />
              <Button
                title={l("Quitar foto", "Remove photo")}
                secondary
                onPress={() => setPhoto(null)}
              />
            </>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                <Chip
                  title={l("Todo", "All")}
                  selected={!filters.masterCategory}
                  onPress={() =>
                    setFilters((v) => ({
                      ...v,
                      masterCategory: undefined,
                      subCategory: undefined,
                      articleType: undefined,
                    }))
                  }
                />
                {meta.data?.taxonomy.map((category) => (
                  <Chip
                    key={category.name}
                    title={category.name}
                    selected={filters.masterCategory === category.name}
                    onPress={() =>
                      setFilters((v) => ({
                        ...v,
                        masterCategory: category.name,
                        subCategory: undefined,
                        articleType: undefined,
                      }))
                    }
                  />
                ))}
              </ScrollView>
              {filters.masterCategory && (
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                  <Chip
                    title={l("Todas las subcategorías", "All subcategories")}
                    selected={!filters.subCategory}
                    onPress={() =>
                      setFilters((v) => ({
                        ...v,
                        subCategory: undefined,
                        articleType: undefined,
                      }))
                    }
                  />
                  {meta.data?.taxonomy
                    .find((c) => c.name === filters.masterCategory)
                    ?.subcategories.map((c) => (
                      <Chip
                        key={c.name}
                        title={c.name}
                        selected={filters.subCategory === c.name}
                        onPress={() =>
                          setFilters((v) => ({
                            ...v,
                            subCategory: c.name,
                            articleType: undefined,
                          }))
                        }
                      />
                    ))}
                </ScrollView>
              )}
              {filters.subCategory && (
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                  <Chip
                    title={l("Todos los tipos", "All article types")}
                    selected={!filters.articleType}
                    onPress={() =>
                      setFilters((v) => ({ ...v, articleType: undefined }))
                    }
                  />
                  {meta.data?.taxonomy
                    .find((c) => c.name === filters.masterCategory)
                    ?.subcategories.find((c) => c.name === filters.subCategory)
                    ?.article_types.map((articleType) => (
                      <Chip
                        key={articleType}
                        title={articleType}
                        selected={filters.articleType === articleType}
                        onPress={() =>
                          setFilters((v) => ({ ...v, articleType }))
                        }
                      />
                    ))}
                </ScrollView>
              )}
              <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                <Chip
                  title={l("Todas las marcas", "All brands")}
                  selected={!filters.brand}
                  onPress={() =>
                    setFilters((v) => ({ ...v, brand: undefined }))
                  }
                />
                {meta.data?.brands.map((brand) => (
                  <Chip
                    key={brand}
                    title={brand}
                    selected={filters.brand === brand}
                    onPress={() => setFilters((v) => ({ ...v, brand }))}
                  />
                ))}
              </ScrollView>
              <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                {(
                  ["relevance", "newest", "priceAsc", "priceDesc"] as const
                ).map((sort, index) => (
                  <Chip
                    key={sort}
                    title={
                      [
                        l("Relevancia", "Relevance"),
                        l("Novedades", "Newest"),
                        l("Menor precio", "Price ↑"),
                        l("Mayor precio", "Price ↓"),
                      ][index]
                    }
                    selected={(filters.sort ?? "relevance") === sort}
                    onPress={() => setFilters((v) => ({ ...v, sort }))}
                  />
                ))}
              </ScrollView>
              <View style={s.spread}>
                <Text style={s.muted}>
                  {l("Con vista para probar", "With try-on view")}
                </Text>
                <Switch
                  accessibilityLabel={l(
                    "Con vista para probar",
                    "With try-on view",
                  )}
                  value={filters.tryOnOnly ?? false}
                  onValueChange={(tryOnOnly) =>
                    setFilters((v) => ({ ...v, tryOnOnly }))
                  }
                  trackColor={{ true: colors.accent }}
                />
              </View>
            </>
          )}
          {result.data && (
            <Text style={s.muted}>
              {result.data.total} {l("resultados", "results")}
            </Text>
          )}
          {result.error && (
            <Empty
              title={l(
                "No pudimos cargar el catálogo",
                "Could not load catalog",
              )}
              retry={() => void result.reload()}
            />
          )}
        </View>
      }
      ListEmptyComponent={
        result.loading ? (
          <Loading />
        ) : !result.error ? (
          <Empty
            title={l("No encontramos prendas", "No pieces found")}
            body={l(
              "Probá otra búsqueda o quitá filtros.",
              "Try another search or remove filters.",
            )}
          />
        ) : null
      }
      ListFooterComponent={
        result.data?.has_more ? (
          <Button
            title={l("Cargar más", "Load more")}
            onPress={more}
            disabled={paging}
            secondary
          />
        ) : null
      }
    />
  );
}
export function ProductScreen({ route }: ScreenProps<"Product">) {
  const { product } = route.params;
  const { l, favorites, toggleFavorite } = useApp();
  const [uri, setUri] = useState(imageFor(product));
  const normalized: CatalogProduct = {
    ...product,
    master_category: product.master_category ?? "",
    sub_category: product.sub_category ?? "",
    article_type: product.article_type ?? "",
    has_try_on: "has_try_on" in product ? product.has_try_on : false,
    images: {
      top: null,
      back: null,
      search: null,
      default: null,
      left: null,
      front: null,
      right: null,
      ...product.images,
    },
  };
  return (
    <Page>
      <Photo key={uri} uri={uri} size={340} />
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        {Object.entries(product.images)
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <Chip
              key={key}
              title={key}
              selected={uri === value}
              onPress={() => setUri(value)}
            />
          ))}
      </ScrollView>
      <Text style={s.eyebrow}>{product.brand}</Text>
      <Text style={s.title}>{product.product_display_name}</Text>
      <Text style={[s.heading, { color: colors.accent }]}>
        {product.price === null
          ? l("Precio no disponible", "Price unavailable")
          : `$ ${product.price.toLocaleString()}`}
      </Text>
      <Text style={s.muted}>
        {[product.article_type, product.gender, product.season, product.usage]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      <Button
        title={
          favorites.some((p) => p.id === product.id)
            ? l("Quitar de favoritos", "Remove from favorites")
            : l("Guardar en favoritos", "Save to favorites")
        }
        icon="heart-outline"
        onPress={() => toggleFavorite(normalized)}
      />
    </Page>
  );
}
export function FavoritesScreen() {
  const { favorites, l } = useApp();
  return (
    <FlatList
      style={s.fill}
      contentContainerStyle={s.page}
      data={favorites}
      numColumns={2}
      keyExtractor={(p) => String(p.id)}
      columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
      renderItem={({ item }) => <ProductCard product={item} />}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 20 }}>
          <Text style={s.title}>{l("Tus favoritos", "Your favorites")}</Text>
          <Text style={s.muted}>
            {l("Guardados en este dispositivo.", "Saved on this device.")}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Empty
          title={l(
            "Tu colección empieza con un favorito",
            "Your collection starts with a favorite",
          )}
          body={l(
            "Abrí una prenda y tocá el corazón para guardarla.",
            "Open a piece and tap the heart to save it.",
          )}
        />
      }
    />
  );
}
export function OutfitScreen({ route }: ScreenProps<"Outfit">) {
  return (
    <Page>
      <Text style={s.title}>{route.params.outfit.summary_label}</Text>
      {route.params.outfit.items.map((item, i) => (
        <View key={i} style={{ gap: 12 }}>
          <Text style={s.heading}>{item.garment_type_label}</Text>
          {(item.best_match ? [item.best_match] : item.product_highlights).map(
            (product) => (
              <ProductCard key={product.id} product={product} />
            ),
          )}
        </View>
      ))}
    </Page>
  );
}
