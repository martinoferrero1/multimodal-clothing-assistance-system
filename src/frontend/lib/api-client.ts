import type {
  AuthResponse, ChatMessage, ChatTurnResponse, Conversation, ConversationStylePreferencesUpdate,
  ConversationUpdate, HealthResponse, MfaEnrollmentResponse, SearchPreferences, SearchPriorityField,
  StoreRegistrationRequest, StoreStatusResponse, UserStylePreferences, UserStylePreferencesUpdate,
  StoreInventoryImportResponse, StoreInventoryItem, StoreInventoryItemWrite,
} from "@/lib/types";

type RequestOptions = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown };

export const AUTH_EXPIRED_EVENT = "lookeate-auth-expired";
let csrfToken: string | null = null;

export function setCsrfToken(value: string | null): void {
  csrfToken = value;
}

export class ApiError extends Error {
  status: number;
  hasExternalMessage: boolean;
  constructor(message: string, status: number, hasExternalMessage = true) {
    super(message);
    this.status = status;
    this.hasExternalMessage = hasExternalMessage;
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    const message = typeof payload === "object" && payload && "detail" in payload ? String(payload.detail) : typeof payload === "string" && payload ? payload : null;
    throw new ApiError(message ?? "API request failed", response.status, Boolean(message));
  }
  return payload as T;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (method !== "GET" && csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`/api/proxy/${path}`, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), cache: "no-store", credentials: "same-origin" });
  return parseApiResponse<T>(response);
}

async function apiFormRequest<T>(path: string, body: FormData): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  return parseApiResponse<T>(await fetch(`/api/proxy/${path}`, { method: "POST", headers, body, cache: "no-store", credentials: "same-origin" }));
}

export const login = (email: string, password: string) => apiRequest<AuthResponse>("api/auth/login", { method: "POST", body: { email, password } });
export const register = (displayName: string, email: string, password: string) => apiRequest<AuthResponse>("api/auth/register", { method: "POST", body: { display_name: displayName, email, password } });
export const restoreSession = () => apiRequest<AuthResponse>("api/auth/session");
export const registerStore = (payload: StoreRegistrationRequest) => apiRequest<AuthResponse>("api/auth/store/register", { method: "POST", body: payload });
export const verifyStoreEmail = (verificationValue: string) => apiRequest<AuthResponse>("api/auth/store/verify-email", { method: "POST", body: { verification_value: verificationValue } });
export const getStoreStatus = () => apiRequest<StoreStatusResponse>("api/auth/store/status");
export const enrollStoreMfa = () => apiRequest<MfaEnrollmentResponse>("api/auth/store/mfa/enroll", { method: "POST" });
export const confirmStoreMfa = (code: string) => apiRequest<StoreStatusResponse>("api/auth/store/mfa/confirm", { method: "POST", body: { code } });
export const listStoreInventory = () => apiRequest<StoreInventoryItem[]>("api/store/inventory/items");
export const createStoreInventoryItem = (payload: StoreInventoryItemWrite) => apiRequest<StoreInventoryItem>("api/store/inventory/items", { method: "POST", body: payload });
export const importStoreInventory = (items: StoreInventoryItemWrite[]) => apiRequest<StoreInventoryImportResponse>("api/store/inventory/import", { method: "POST", body: { items } });
export const logout = () => apiRequest<void>("api/auth/logout", { method: "POST" });
export const logoutAll = () => apiRequest<void>("api/auth/logout-all", { method: "POST" });
export const getHealth = () => apiRequest<HealthResponse>("health");
export const updateUserSearchPreferences = (priorityFields: SearchPriorityField[]) => apiRequest<SearchPreferences>("api/users/me/search-preferences", { method: "PUT", body: { priority_fields: priorityFields } });
export const updateUserStylePreferences = (payload: UserStylePreferencesUpdate) => apiRequest<UserStylePreferences>("api/users/me/style-preferences", { method: "PUT", body: payload });
export const clearUserExplicitStylePreferences = () => apiRequest<UserStylePreferences>("api/users/me/style-preferences/explicit", { method: "DELETE" });
export const removeUserInferredStylePreference = (inferredId: string) => apiRequest<UserStylePreferences>(`api/users/me/style-preferences/inferred/${inferredId}`, { method: "DELETE" });
export const listConversations = () => apiRequest<Conversation[]>("api/users/me/conversations");
export const createConversation = (title?: string) => apiRequest<Conversation>("api/users/me/conversations", { method: "POST", body: { title: title?.trim() || null } });
export const deleteConversation = (conversationId: string) => apiRequest<void>(`api/conversations/${conversationId}`, { method: "DELETE" });
export const updateConversation = (conversationId: string, payload: ConversationUpdate) => apiRequest<Conversation>(`api/conversations/${conversationId}`, { method: "PATCH", body: payload });
export const reorderConversations = (conversationIds: string[]) => apiRequest<Conversation[]>("api/conversations/order", { method: "PUT", body: { conversation_ids: conversationIds } });
export const getConversation = (conversationId: string) => apiRequest<Conversation>(`api/conversations/${conversationId}`);
export const updateConversationSearchPreferences = (conversationId: string, priorityFields: SearchPriorityField[] | null) => apiRequest<Conversation>(`api/conversations/${conversationId}/search-preferences`, { method: "PUT", body: { priority_fields: priorityFields } });
export const updateConversationStylePreferences = (conversationId: string, payload: ConversationStylePreferencesUpdate) => apiRequest<Conversation>(`api/conversations/${conversationId}/style-preferences`, { method: "PUT", body: payload });
export const listMessages = (conversationId: string) => apiRequest<ChatMessage[]>(`api/conversations/${conversationId}/messages`);
export async function sendMessage(conversationId: string, content: string, images: File[] = []): Promise<ChatTurnResponse> {
  if (images.length) { const body = new FormData(); body.set("content", content); images.forEach((image) => body.append("images", image)); return apiFormRequest(`api/conversations/${conversationId}/messages/with-images`, body); }
  return apiRequest<ChatTurnResponse>(`api/conversations/${conversationId}/messages`, { method: "POST", body: { content } });
}
