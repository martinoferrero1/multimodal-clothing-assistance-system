import type {
  AuthResponse,
  ChatMessage,
  ChatTurnResponse,
  Conversation,
  ConversationStylePreferencesUpdate,
  HealthResponse,
  SearchPreferences,
  SearchPriorityField,
  User,
  UserStylePreferences,
  UserStylePreferencesUpdate,
} from "@/lib/types";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string;
  body?: unknown;
};

export const AUTH_EXPIRED_EVENT = "digital-atelier-auth-expired";

export class ApiError extends Error {
  status: number;
  hasExternalMessage: boolean;

  constructor(message: string, status: number, hasExternalMessage = true) {
    super(message);
    this.status = status;
    this.hasExternalMessage = hasExternalMessage;
  }
}

async function parseApiResponse<T>(response: Response, hasToken: boolean): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401 && hasToken && typeof window !== "undefined") {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }

    const externalMessage =
      typeof payload === "object" && payload && "detail" in payload
        ? String(payload.detail)
        : typeof payload === "string" && payload
          ? payload
          : null;
    throw new ApiError(externalMessage ?? "API request failed", response.status, Boolean(externalMessage));
  }

  return payload as T;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`/api/proxy/${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  return parseApiResponse<T>(response, Boolean(options.token));
}

async function apiFormRequest<T>(path: string, token: string, body: FormData): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  });

  const response = await fetch(`/api/proxy/${path}`, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  return parseApiResponse<T>(response, true);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function register(
  displayName: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("api/auth/register", {
    method: "POST",
    body: { display_name: displayName, email, password },
  });
}

export async function getMe(token: string): Promise<User> {
  return apiRequest<User>("api/users/me", { token });
}

export async function updateUserSearchPreferences(
  token: string,
  priorityFields: SearchPriorityField[],
): Promise<SearchPreferences> {
  return apiRequest<SearchPreferences>("api/users/me/search-preferences", {
    method: "PUT",
    token,
    body: { priority_fields: priorityFields },
  });
}

export async function updateUserStylePreferences(
  token: string,
  payload: UserStylePreferencesUpdate,
): Promise<UserStylePreferences> {
  return apiRequest<UserStylePreferences>("api/users/me/style-preferences", {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function clearUserExplicitStylePreferences(token: string): Promise<UserStylePreferences> {
  return apiRequest<UserStylePreferences>("api/users/me/style-preferences/explicit", {
    method: "DELETE",
    token,
  });
}

export async function removeUserInferredStylePreference(
  token: string,
  inferredId: string,
): Promise<UserStylePreferences> {
  return apiRequest<UserStylePreferences>(`api/users/me/style-preferences/inferred/${inferredId}`, {
    method: "DELETE",
    token,
  });
}

export async function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("health");
}

export async function listConversations(token: string): Promise<Conversation[]> {
  return apiRequest<Conversation[]>("api/users/me/conversations", { token });
}

export async function createConversation(token: string, title?: string): Promise<Conversation> {
  return apiRequest<Conversation>("api/users/me/conversations", {
    method: "POST",
    token,
    body: { title: title?.trim() || null },
  });
}

export async function getConversation(token: string, conversationId: string): Promise<Conversation> {
  return apiRequest<Conversation>(`api/conversations/${conversationId}`, { token });
}

export async function updateConversationSearchPreferences(
  token: string,
  conversationId: string,
  priorityFields: SearchPriorityField[] | null,
): Promise<Conversation> {
  return apiRequest<Conversation>(`api/conversations/${conversationId}/search-preferences`, {
    method: "PUT",
    token,
    body: { priority_fields: priorityFields },
  });
}

export async function updateConversationStylePreferences(
  token: string,
  conversationId: string,
  payload: ConversationStylePreferencesUpdate,
): Promise<Conversation> {
  return apiRequest<Conversation>(`api/conversations/${conversationId}/style-preferences`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function listMessages(token: string, conversationId: string): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`api/conversations/${conversationId}/messages`, { token });
}

export async function sendMessage(
  token: string,
  conversationId: string,
  content: string,
  images: File[] = [],
): Promise<ChatTurnResponse> {
  if (images.length > 0) {
    const body = new FormData();
    body.set("content", content);
    for (const image of images) {
      body.append("images", image);
    }
    return apiFormRequest<ChatTurnResponse>(
      `api/conversations/${conversationId}/messages/with-images`,
      token,
      body,
    );
  }

  return apiRequest<ChatTurnResponse>(`api/conversations/${conversationId}/messages`, {
    method: "POST",
    token,
    body: { content },
  });
}
