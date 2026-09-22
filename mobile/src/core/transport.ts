import type { MobileConfig } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export interface CredentialStore {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
}

// Native-only transport. The browser frontend continues to use HttpOnly cookies.
export class Transport {
  private csrf: string | null = null;
  private generation = 0;
  private credentialQueue = Promise.resolve();
  onExpired: () => void = () => {};
  constructor(
    private config: MobileConfig,
    private credentials: CredentialStore,
    private fetcher: typeof fetch,
  ) {}
  setCsrf(value: string | null) {
    this.csrf = value;
  }
  private mutateCredentials(action: () => Promise<void>) {
    const pending = this.credentialQueue.catch(() => {}).then(action);
    this.credentialQueue = pending;
    return pending;
  }
  async clear() {
    this.generation++;
    this.csrf = null;
    await this.mutateCredentials(() => this.credentials.clear());
  }
  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      form?: FormData;
      timeout?: number;
    } = {},
  ): Promise<T> {
    if (!/^api\/[a-z0-9/?=&%+_.-]+$/i.test(path) || path.includes(".."))
      throw new Error("Invalid API path");
    const generation = this.generation;
    await this.credentialQueue;
    const cookie = await this.credentials.read();
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {
      Accept: "application/json",
      Origin: this.config.origin,
    };
    if (cookie) headers.Cookie = cookie;
    if (method !== "GET" && this.csrf) headers["X-CSRF-Token"] = this.csrf;
    if (options.body !== undefined)
      headers["Content-Type"] = "application/json";
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options.timeout ?? 30000,
    );
    try {
      const response = await this.fetcher(`${this.config.apiUrl}/${path}`, {
        method,
        headers,
        body:
          options.form ??
          (options.body === undefined
            ? undefined
            : JSON.stringify(options.body)),
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
      if (generation !== this.generation)
        throw new ApiError("Session changed. Please try again.", 409);
      // RN's Headers polyfill may expose only get(); Lookeate issues one cookie.
      const cookies =
        typeof response.headers.getSetCookie === "function"
          ? response.headers.getSetCookie()
          : [response.headers.get("set-cookie") ?? ""];
      for (const raw of cookies) {
        const pair = raw.split(";", 1)[0];
        if (pair.slice(0, pair.indexOf("=")) !== this.config.cookieName)
          continue;
        const value = pair.slice(pair.indexOf("=") + 1);
        if (!value || /max-age=0(?:;|$)/i.test(raw)) await this.clear();
        else if (/^[A-Za-z0-9_-]+$/.test(value)) {
          this.generation++;
          await this.mutateCredentials(() => this.credentials.write(pair));
        }
      }
      if (response.status === 401) {
        await this.clear();
        this.onExpired();
      }
      if (!response.ok)
        throw new ApiError(
          response.status === 429
            ? "Too many requests. Please try again later."
            : "Request failed. Please try again.",
          response.status,
        );
      if (response.status === 204) return undefined as T;
      const acceptedGeneration = this.generation;
      const payload = (await response.json()) as T;
      if (acceptedGeneration !== this.generation)
        throw new ApiError("Session changed. Please try again.", 409);
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }
}
