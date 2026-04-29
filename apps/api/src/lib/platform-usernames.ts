/** Strip URLs and @ so platform sync and DB always store a plain handle. */
export function normalizeLeetCodeUsername(raw: string): string {
  const s = raw.trim().replace(/^@/, "");
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) {
    try {
      const url = new URL(s);
      const host = url.hostname.replace(/^www\./, "");
      if (!/^leetcode\.(com|cn)$/i.test(host)) return "";
      const segments = url.pathname
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .filter(Boolean);
      if (segments[0]?.toLowerCase() === "u" && segments[1]) return segments[1]!;
      return segments[0] ?? "";
    } catch {
      return "";
    }
  }
  return s.replace(/^u\//i, "").split("/")[0]?.trim() ?? "";
}

export function normalizeGitHubUsername(raw: string): string {
  let s = raw.trim().replace(/^@/, "");
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) {
    try {
      const url = new URL(s);
      const host = url.hostname.replace(/^www\./, "");
      if (host !== "github.com") return "";
      const segments = url.pathname
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .filter(Boolean);
      return segments[0] ?? "";
    } catch {
      return "";
    }
  }
  return s.split("/")[0]?.trim() ?? "";
}
