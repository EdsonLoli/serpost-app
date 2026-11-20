const STORAGE_URL_KEY = "serpost_backend_url";
const STORAGE_TOKEN_KEY = "serpost_backend_token";

export const DEFAULT_BACKEND_URL = "http://localhost:3001";

export function getSavedBackendUrl(): string {
  try {
    return localStorage.getItem(STORAGE_URL_KEY) || DEFAULT_BACKEND_URL;
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

export function saveBackendUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_URL_KEY, url.trim() || DEFAULT_BACKEND_URL);
  } catch {
    // Ignorar errores de almacenamiento en entornos restringidos
  }
}

export function getSavedToken(): string {
  try {
    return localStorage.getItem(STORAGE_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function saveBackendToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
  } catch {
    // Ignorar errores de almacenamiento en entornos restringidos
  }
}
