import type { GarmentRecommendation } from "./types";

// Keep the preferred match first, without hiding alternatives or repeating it.
export function garmentProducts(garment: GarmentRecommendation) {
  const products = garment.best_match
    ? [garment.best_match, ...garment.product_highlights]
    : garment.product_highlights;
  return products.filter(
    (product, index) =>
      products.findIndex((other) => other.id === product.id) === index,
  );
}
