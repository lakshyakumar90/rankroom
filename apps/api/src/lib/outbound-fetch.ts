/**
 * Default headers for server-side fetches to third-party APIs (LeetCode, GitHub, contribution APIs).
 * Many endpoints block or throttle requests without a browser-like User-Agent.
 */
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function mergeOutboundHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (!headers.has("User-Agent")) headers.set("User-Agent", DEFAULT_UA);
  if (!headers.has("Accept")) headers.set("Accept", "application/json, text/plain, */*");
  if (!headers.has("Accept-Language")) headers.set("Accept-Language", "en-US,en;q=0.9");
  return headers;
}

export async function outboundJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: mergeOutboundHeaders(init?.headers),
  });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function outboundText(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  const response = await fetch(input, {
    ...init,
    headers: mergeOutboundHeaders(init?.headers),
  });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.text();
}
