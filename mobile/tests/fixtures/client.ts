// Only resolved by the explicitly enabled Metro web test server.
import { ApiError } from "../../src/core/transport";
export { ApiError };
const session = {
  onExpired: () => {},
  setCsrf: (_value: string | null) => {},
  clear: async () => {},
};
export function transport() {
  return session;
}
export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const response = await fetch(`/__fixtures__/${path}`, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body:
      options.form ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  if (!response.ok) {
    if (response.status === 401) session.onExpired();
    throw new ApiError("Fixture request failed", response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const apiFormRequest = <T>(path: string, form: FormData) =>
  apiRequest<T>(path, { method: "POST", form });
export function appendImages() {
  throw new Error("Image uploads require a native device");
}
