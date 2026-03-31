import { createClient } from "./supabase/client";

const SERVER_API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

function getApiBaseUrl() {
  return typeof window === "undefined" ? SERVER_API_URL : "";
}

async function getAuthToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  authToken?: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiBaseUrl = getApiBaseUrl();
  const token = options.authToken ?? await getAuthToken();
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body
      ? {
          body: isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body),
        }
      : {}),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(errorData.error ?? `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, options),
  post: <T>(path: string, body: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { method: "POST", body, ...options }),
  put: <T>(path: string, body: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { method: "PUT", body, ...options }),
  patch: <T>(path: string, body: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { method: "PATCH", body, ...options }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { method: "DELETE", ...options }),
};
