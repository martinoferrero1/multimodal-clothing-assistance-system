import type { CatalogProduct } from "@/lib/types";

const FAVORITES_KEY = "lookeate-favorite-products";
export const FAVORITES_CHANGED_EVENT = "favorites:changed";

let favoriteSnapshot: CatalogProduct[] = [];

function isCatalogProduct(value: unknown): value is CatalogProduct {
  if (!value || typeof value !== "object") return false;
  const product = value as Partial<CatalogProduct>;
  return typeof product.id === "number" && typeof product.product_display_name === "string" && typeof product.images === "object" && product.images !== null;
}

export function readFavoriteProducts(): CatalogProduct[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCatalogProduct) : [];
  } catch {
    return [];
  }
}

if (typeof window !== "undefined") {
  favoriteSnapshot = readFavoriteProducts();
}

export function subscribeFavorites(onStoreChange: () => void): () => void {
  function syncFavorites() {
    favoriteSnapshot = readFavoriteProducts();
    onStoreChange();
  }
  window.addEventListener(FAVORITES_CHANGED_EVENT, onStoreChange);
  window.addEventListener("storage", syncFavorites);
  return () => {
    window.removeEventListener(FAVORITES_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("storage", syncFavorites);
  };
}

export function getFavoritesSnapshot(): CatalogProduct[] {
  return favoriteSnapshot;
}

export function getServerFavoritesSnapshot(): CatalogProduct[] {
  return [];
}

function writeFavoriteProducts(products: CatalogProduct[]): void {
  favoriteSnapshot = products;
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(products));
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
}

export function toggleFavoriteProduct(product: CatalogProduct): CatalogProduct[] {
  const current = readFavoriteProducts();
  const next = current.some((item) => item.id === product.id)
    ? current.filter((item) => item.id !== product.id)
    : [product, ...current];
  writeFavoriteProducts(next);
  return next;
}

export function productImage(product: CatalogProduct): string | null {
  return product.images.default || product.images.front || product.images.search || product.images.top || product.images.left || product.images.right || product.images.back;
}
