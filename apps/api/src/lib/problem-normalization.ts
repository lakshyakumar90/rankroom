type LegacyVisibility = "GLOBAL" | "DEPARTMENT" | "CLASS" | "CONTEST_ONLY" | "ASSIGNMENT_ONLY";
type NormalizedScope = "GLOBAL" | "DEPARTMENT" | "SECTION";

export function mapVisibilityToScope(visibility: LegacyVisibility): NormalizedScope {
  if (visibility === "DEPARTMENT") return "DEPARTMENT";
  if (visibility === "CLASS") return "SECTION";
  return "GLOBAL";
}

export function mapScopeToVisibility(scope: NormalizedScope): LegacyVisibility {
  if (scope === "DEPARTMENT") return "DEPARTMENT";
  if (scope === "SECTION") return "CLASS";
  return "GLOBAL";
}

export function normalizeTagRefs(tags: string[]) {
  return tags
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => ({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    }));
}

export function normalizeBoilerplates(starterCode: unknown) {
  if (!starterCode || typeof starterCode !== "object" || Array.isArray(starterCode)) {
    return [] as Array<{ language: string; code: string }>;
  }

  return Object.entries(starterCode as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
    .map(([language, code]) => ({ language, code }));
}
