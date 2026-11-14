import type { Page } from "@playwright/test";

export const details = {
  liked_styles: [],
  disliked_styles: [],
  preferred_colors: [],
  avoided_colors: [],
  preferred_brands: [],
  avoided_brands: [],
  preferred_fits: [],
  occasions: [],
  budget_notes: null,
  sizing_notes: null,
  freeform_notes: null,
};
export const member = {
  csrf_token: "test-only-csrf",
  selected_store: null,
  user: {
    id: "test-member",
    display_name: "Alex",
    email: "alex@example.test",
    created_at: "2026-10-01",
    search_preferences: { priority_fields: ["category", "gender"] },
    style_preferences: {
      use_personalized_styles: true,
      explicit: details,
      inferred: [],
    },
  },
};
export const product = {
  id: 1,
  product_display_name: "Camisa de lino",
  brand: "Test Studio",
  price: 75,
  year: 2026,
  usage: "Casual",
  gender: "Unisex",
  master_category: "Apparel",
  sub_category: "Topwear",
  article_type: "Shirts",
  season: "Summer",
  has_try_on: false,
  images: {
    top: null,
    back: null,
    search: null,
    default: null,
    left: null,
    front: null,
    right: null,
  },
};
export const alternative = {
  ...product,
  id: 2,
  product_display_name: "Camisa alternativa",
};
export const conversation = {
  id: "chat-1",
  user_id: member.user.id,
  title: "Looks de verano",
  is_pinned: false,
  summary: null,
  message_count: 1,
  last_message_preview: "Busco una camisa",
  created_at: "2026-10-01",
  updated_at: "2026-10-01",
  search_preferences: {
    priority_fields: null,
    effective_priority_fields: ["category"],
  },
  style_preferences: {
    use_personalized_styles: null,
    effective_use_personalized_styles: true,
    temporary: { ...details },
  },
};
export const message = {
  id: "message-1",
  conversation_id: "chat-1",
  role: "assistant",
  content: "Estas prendas van bien juntas.",
  attachments: [],
  final_response_payload: {
    message: "Estas prendas van bien juntas.",
    sections: [],
    recommendations: {
      garments: [
        {
          kind: "garment",
          summary_label: "Camisas frescas",
          garment_type_label: "Camisa",
          best_match: product,
          product_highlights: [product, alternative],
        },
      ],
      outfits: [
        {
          kind: "outfit",
          summary_label: "Look de verano",
          items: [
            {
              kind: "garment",
              garment_type_label: "Camisa",
              summary_label: "Camisas",
              best_match: product,
              product_highlights: [alternative],
            },
          ],
        },
      ],
      product_highlights: [],
    },
  },
};
export const listings = [
  {
    id: "listing-1",
    kind: "blog",
    title: "Lino para todos los días",
    description: "Ideas para el verano",
    location: "Buenos Aires",
    store_display_name: "Test Studio",
    store_handle: "test-studio",
    is_subscribed: false,
    external_url: null,
  },
  {
    id: "listing-2",
    kind: "event",
    title: "Encuentro de diseño",
    description: "Diseño independiente",
    location: "Córdoba",
    store_display_name: "Otra tienda",
    is_subscribed: false,
    starts_at: "2026-11-10T18:00:00-03:00",
    external_url: null,
  },
];

export async function mockApi(
  page: Page,
  role: "anonymous" | "member" | "store" = "member",
) {
  const writes: { path: string; body: any; method: string }[] = [];
  let authenticated = role !== "anonymous";
  const auth = structuredClone(member) as any;
  if (role === "store")
    auth.selected_store = {
      id: "store-1",
      display_name: "Test Studio",
      handle: "test-studio",
      status: "active",
      email_verified: true,
      mfa_enrolled: false,
      mfa_confirmed: false,
    };
  const chats = [structuredClone(conversation)];
  const posts = structuredClone(listings);
  let inventory: any[] = [];
  await page.route("**/__fixtures__/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/__fixtures__/", "");
    const method = request.method();
    const body = request.postDataJSON();
    if (method !== "GET") writes.push({ path, body, method });
    let data: unknown;
    let status = 200;
    if (path === "api/auth/session") {
      data = auth;
      if (!authenticated) status = 401;
    } else if (path === "api/auth/login" || path === "api/auth/register") {
      authenticated = true;
      data = auth;
    } else if (path.startsWith("api/auth/logout")) {
      authenticated = false;
      status = 204;
    } else if (path === "api/catalog/meta")
      data = {
        taxonomy: [
          {
            name: "Apparel",
            subcategories: [{ name: "Topwear", article_types: ["Shirts"] }],
          },
        ],
        brands: ["Test Studio"],
      };
    else if (path === "api/catalog/products") {
      const items = [product, alternative].filter((item) =>
        item.product_display_name
          .toLowerCase()
          .includes((url.searchParams.get("query") ?? "").toLowerCase()),
      );
      data = {
        items,
        total: items.length,
        offset: 0,
        limit: 12,
        has_more: false,
      };
    } else if (path === "api/users/me/conversations") {
      if (method === "POST") {
        const next = {
          ...structuredClone(conversation),
          id: `chat-${chats.length + 1}`,
          title: "Nueva conversación",
        };
        chats.push(next);
        data = next;
      } else data = chats;
    } else if (path === "api/conversations/order") {
      data = body.conversation_ids.map((id: string) =>
        chats.find((chat) => chat.id === id),
      );
    } else if (/api\/conversations\/[^/]+\/messages$/.test(path))
      data =
        method === "GET"
          ? [message]
          : {
              user_message: {
                id: "user-1",
                role: "user",
                content: body.content,
              },
              assistant_message: { ...message, id: "message-2" },
            };
    else if (path.startsWith("api/conversations/")) {
      const chat = chats.find((item) => item.id === path.split("/")[2])!;
      if (path.endsWith("style-preferences"))
        chat.style_preferences = { ...chat.style_preferences, ...body };
      else if (path.endsWith("search-preferences"))
        chat.search_preferences = { ...chat.search_preferences, ...body };
      else if (method === "PATCH") Object.assign(chat, body);
      else if (method === "DELETE") {
        chats.splice(chats.indexOf(chat), 1);
        status = 204;
      }
      data = chat;
    } else if (path === "api/community/listings") data = posts;
    else if (path.endsWith("/subscribe")) {
      const post = posts.find((item) => item.id === path.split("/")[3])!;
      post.is_subscribed = method === "POST";
      data = { is_subscribed: post.is_subscribed };
    } else if (path === "api/community/join") {
      posts[0].is_subscribed = true;
      data = { listing_id: posts[0].id, is_subscribed: true };
    } else if (path === "api/store/inventory/items") {
      if (method === "POST") {
        const item = { ...body, id: "inventory-1" };
        inventory.push(item);
        data = item;
      } else data = inventory;
    } else if (path.startsWith("api/store/inventory/items/")) {
      if (method === "DELETE") {
        inventory = [];
        status = 204;
      } else {
        inventory[0] = { ...inventory[0], ...body };
        data = inventory[0];
      }
    } else if (path === "api/store/community/listings") {
      if (method === "POST") {
        const post = { ...body, id: "store-post" };
        posts.push(post);
        data = post;
      } else data = posts;
    } else {
      status = 404;
      data = { error: `Unhandled fixture: ${path}` };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: status === 204 ? "" : JSON.stringify(data),
    });
  });
  return writes;
}
