import * as SecureStore from "expo-secure-store";
import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { validateConfig } from "./config";
import { Transport } from "./transport";

export { ApiError } from "./transport";
let instance: Transport | undefined;
export function transport() {
  if (!instance) {
    const config = validateConfig(
      process.env.EXPO_PUBLIC_API_URL,
      process.env.EXPO_PUBLIC_APP_ORIGIN,
      process.env.EXPO_PUBLIC_SESSION_COOKIE_NAME,
      __DEV__,
    );
    const endpointKey = Array.from(config.apiUrl)
      .map((character) => character.codePointAt(0)!.toString(16))
      .join("-");
    const key = `lookeate.session.${endpointKey}.${config.cookieName}`;
    instance = new Transport(
      config,
      {
        read: () => SecureStore.getItemAsync(key),
        write: (value) =>
          SecureStore.setItemAsync(key, value, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
        clear: () => SecureStore.deleteItemAsync(key),
      },
      fetch as typeof globalThis.fetch,
    );
  }
  return instance;
}
export const apiRequest = <T>(path: string, options = {}) =>
  transport().request<T>(path, options);
export const apiFormRequest = <T>(path: string, form: FormData) =>
  transport().request<T>(path, { method: "POST", form, timeout: 180000 });
export type PickedImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};
export function appendImages(body: FormData, images: PickedImage[]) {
  images.forEach((image, index) =>
    body.append(
      "images",
      new File(image.uri),
      image.fileName ?? `photo-${index}.jpg`,
    ),
  );
}
