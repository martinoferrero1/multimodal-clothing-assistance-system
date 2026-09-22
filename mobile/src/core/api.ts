import type {
  AuthResponse,
  ChatMessage,
  ChatTurnResponse,
  Conversation,
  ConversationStylePreferencesUpdate,
  ConversationUpdate,
  MfaEnrollmentResponse,
  SearchPreferences,
  SearchPriorityField,
  StoreRegistrationRequest,
  StoreStatusResponse,
  UserStylePreferences,
  UserStylePreferencesUpdate,
  StoreInventoryImportResponse,
  StoreInventoryItem,
  StoreInventoryItemWrite,
  CommunityJoinState,
  CommunityListing,
  CommunityListingWrite,
  CommunitySubscriptionState,
  StoreCommunityListing,
  CatalogMeta,
  CatalogPage,
  CatalogQuery,
} from "./types";

import {
  apiRequest,
  apiFormRequest,
  appendImages,
  type PickedImage,
} from "./client";

export const login = (email: string, password: string) =>
  apiRequest<AuthResponse>("api/auth/login", {
    method: "POST",
    body: { email, password },
  });
export const register = (
  displayName: string,
  email: string,
  password: string,
) =>
  apiRequest<AuthResponse>("api/auth/register", {
    method: "POST",
    body: { display_name: displayName, email, password },
  });
export const restoreSession = () =>
  apiRequest<AuthResponse>("api/auth/session");
export const registerStore = (payload: StoreRegistrationRequest) =>
  apiRequest<AuthResponse>("api/auth/store/register", {
    method: "POST",
    body: payload,
  });
export const verifyStoreEmail = (verificationValue: string) =>
  apiRequest<AuthResponse>("api/auth/store/verify-email", {
    method: "POST",
    body: { verification_value: verificationValue },
  });
export const getStoreStatus = () =>
  apiRequest<StoreStatusResponse>("api/auth/store/status");
export const enrollStoreMfa = () =>
  apiRequest<MfaEnrollmentResponse>("api/auth/store/mfa/enroll", {
    method: "POST",
  });
export const confirmStoreMfa = (code: string) =>
  apiRequest<StoreStatusResponse>("api/auth/store/mfa/confirm", {
    method: "POST",
    body: { code },
  });
export const listStoreInventory = () =>
  apiRequest<StoreInventoryItem[]>("api/store/inventory/items");
export const createStoreInventoryItem = (payload: StoreInventoryItemWrite) =>
  apiRequest<StoreInventoryItem>("api/store/inventory/items", {
    method: "POST",
    body: payload,
  });
export const updateStoreInventoryItem = (
  itemId: string,
  payload: StoreInventoryItemWrite,
) =>
  apiRequest<StoreInventoryItem>(`api/store/inventory/items/${itemId}`, {
    method: "PUT",
    body: payload,
  });
export const deleteStoreInventoryItem = (itemId: string) =>
  apiRequest<void>(`api/store/inventory/items/${itemId}`, { method: "DELETE" });
export const importStoreInventory = (items: StoreInventoryItemWrite[]) =>
  apiRequest<StoreInventoryImportResponse>("api/store/inventory/import", {
    method: "POST",
    body: { items },
  });
export const listCommunityListings = () =>
  apiRequest<CommunityListing[]>("api/community/listings");
export const subscribeToCommunityListing = (listingId: string) =>
  apiRequest<CommunitySubscriptionState>(
    `api/community/listings/${listingId}/subscribe`,
    { method: "POST" },
  );
export const unsubscribeFromCommunityListing = (listingId: string) =>
  apiRequest<CommunitySubscriptionState>(
    `api/community/listings/${listingId}/subscribe`,
    { method: "DELETE" },
  );
export const joinCommunityListingByCode = (code: string) =>
  apiRequest<CommunityJoinState>("api/community/join", {
    method: "POST",
    body: { code },
  });
export const listStoreCommunityListings = () =>
  apiRequest<StoreCommunityListing[]>("api/store/community/listings");
export const createStoreCommunityListing = (payload: CommunityListingWrite) =>
  apiRequest<StoreCommunityListing>("api/store/community/listings", {
    method: "POST",
    body: payload,
  });
export const updateStoreCommunityListing = (
  listingId: string,
  payload: CommunityListingWrite,
) =>
  apiRequest<StoreCommunityListing>(
    `api/store/community/listings/${listingId}`,
    { method: "PUT", body: payload },
  );
export const deleteStoreCommunityListing = (listingId: string) =>
  apiRequest<void>(`api/store/community/listings/${listingId}`, {
    method: "DELETE",
  });
export const logout = () =>
  apiRequest<void>("api/auth/logout", { method: "POST" });
export const logoutAll = () =>
  apiRequest<void>("api/auth/logout-all", { method: "POST" });

export const getCatalogMeta = () => apiRequest<CatalogMeta>("api/catalog/meta");
export const listCatalogProducts = (filters: CatalogQuery = {}) => {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.masterCategory)
    params.set("master_category", filters.masterCategory);
  if (filters.subCategory) params.set("sub_category", filters.subCategory);
  if (filters.articleType) params.set("article_type", filters.articleType);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.tryOnOnly) params.set("try_on_only", "true");
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.offset !== undefined)
    params.set("offset", String(filters.offset));
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  return apiRequest<CatalogPage>(`api/catalog/products?${params.toString()}`);
};
export const searchCatalogByImage = (
  images: PickedImage[],
  offset = 0,
  limit = 12,
) => {
  const body = new FormData();
  appendImages(body, images);
  return apiFormRequest<CatalogPage>(
    `api/catalog/visual-search?offset=${offset}&limit=${limit}`,
    body,
  );
};
export const updateUserSearchPreferences = (
  priorityFields: SearchPriorityField[],
) =>
  apiRequest<SearchPreferences>("api/users/me/search-preferences", {
    method: "PUT",
    body: { priority_fields: priorityFields },
  });
export const updateUserStylePreferences = (
  payload: UserStylePreferencesUpdate,
) =>
  apiRequest<UserStylePreferences>("api/users/me/style-preferences", {
    method: "PUT",
    body: payload,
  });
export const clearUserExplicitStylePreferences = () =>
  apiRequest<UserStylePreferences>("api/users/me/style-preferences/explicit", {
    method: "DELETE",
  });
export const removeUserInferredStylePreference = (inferredId: string) =>
  apiRequest<UserStylePreferences>(
    `api/users/me/style-preferences/inferred/${inferredId}`,
    { method: "DELETE" },
  );
export const listConversations = () =>
  apiRequest<Conversation[]>("api/users/me/conversations");
export const createConversation = (title?: string) =>
  apiRequest<Conversation>("api/users/me/conversations", {
    method: "POST",
    body: { title: title?.trim() || null },
  });
export const deleteConversation = (conversationId: string) =>
  apiRequest<void>(`api/conversations/${conversationId}`, { method: "DELETE" });
export const updateConversation = (
  conversationId: string,
  payload: ConversationUpdate,
) =>
  apiRequest<Conversation>(`api/conversations/${conversationId}`, {
    method: "PATCH",
    body: payload,
  });
export const reorderConversations = (conversationIds: string[]) =>
  apiRequest<Conversation[]>("api/conversations/order", {
    method: "PUT",
    body: { conversation_ids: conversationIds },
  });
export const getConversation = (conversationId: string) =>
  apiRequest<Conversation>(`api/conversations/${conversationId}`);
export const updateConversationSearchPreferences = (
  conversationId: string,
  priorityFields: SearchPriorityField[] | null,
) =>
  apiRequest<Conversation>(
    `api/conversations/${conversationId}/search-preferences`,
    { method: "PUT", body: { priority_fields: priorityFields } },
  );
export const updateConversationStylePreferences = (
  conversationId: string,
  payload: ConversationStylePreferencesUpdate,
) =>
  apiRequest<Conversation>(
    `api/conversations/${conversationId}/style-preferences`,
    { method: "PUT", body: payload },
  );
export const listMessages = (conversationId: string) =>
  apiRequest<ChatMessage[]>(`api/conversations/${conversationId}/messages`);
export async function sendMessage(
  conversationId: string,
  content: string,
  images: PickedImage[] = [],
): Promise<ChatTurnResponse> {
  if (images.length) {
    const body = new FormData();
    body.set("content", content);
    appendImages(body, images);
    return apiFormRequest(
      `api/conversations/${conversationId}/messages/with-images`,
      body,
    );
  }
  return apiRequest<ChatTurnResponse>(
    `api/conversations/${conversationId}/messages`,
    { method: "POST", body: { content }, timeout: 180000 },
  );
}
