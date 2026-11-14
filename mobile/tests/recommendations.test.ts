import { test } from "node:test";
import assert from "node:assert/strict";
import { garmentProducts } from "../src/core/recommendations";
import type {
  GarmentRecommendation,
  ProductRecommendation,
} from "../src/core/types";

test("recommendations keep alternatives, deduplicate the best match and retain rank", () => {
  const best = { id: 1 } as ProductRecommendation;
  const second = { id: 2 } as ProductRecommendation;
  const garment = {
    best_match: best,
    product_highlights: [second, best, second],
  } as GarmentRecommendation;
  assert.deepEqual(garmentProducts(garment), [best, second]);
  assert.deepEqual(garmentProducts({ ...garment, best_match: null }), [
    second,
    best,
  ]);
  assert.deepEqual(
    garmentProducts({ ...garment, best_match: null, product_highlights: [] }),
    [],
  );
});
