import { outboundJson } from "./outbound-fetch";
import { logger } from "./logger";

type Heatmap = Record<string, number>;

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const CONTRIBUTION_CALENDAR_QUERY = `
  query ContributionCalendar($login: String!) {
    user(login: $login) {
      login
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

type GraphQLResponse = {
  data?: {
    user?: {
      login?: string;
      contributionsCollection?: {
        contributionCalendar?: {
          totalContributions?: number;
          weeks?: Array<{
            contributionDays?: Array<{
              date?: string;
              contributionCount?: number;
            }>;
          }>;
        };
      };
    };
  };
  errors?: Array<{ message?: string }>;
};

function parseContributionCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  return 0;
}

/**
 * Fetches contribution calendar via GitHub's official GraphQL API (same data as the green graph on github.com).
 * Requires `GITHUB_TOKEN` or `GITHUB_GRAPHQL_TOKEN` (classic PAT or fine‑grained with read access to user metadata).
 * Returns null if no token or the user cannot be resolved.
 */
export async function fetchGitHubOfficialContributionHeatmap(login: string): Promise<{
  total: number;
  heatmap: Heatmap;
} | null> {
  const token = process.env["GITHUB_TOKEN"]?.trim() || process.env["GITHUB_GRAPHQL_TOKEN"]?.trim();
  if (!token) {
    return null;
  }

  try {
    const body = await outboundJson<GraphQLResponse>(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: CONTRIBUTION_CALENDAR_QUERY,
        variables: { login },
      }),
    });

    if (body.errors?.length) {
      logger.warn({ login, errors: body.errors }, "GitHub GraphQL contribution query returned errors");
      return null;
    }

    const calendar = body.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) {
      return null;
    }

    const heatmap: Heatmap = {};
    for (const week of calendar.weeks ?? []) {
      for (const day of week.contributionDays ?? []) {
        const date = typeof day.date === "string" ? day.date : null;
        if (!date) continue;
        const count = parseContributionCount(day.contributionCount);
        heatmap[date] = (heatmap[date] ?? 0) + count;
      }
    }

    const declaredTotal = parseContributionCount(calendar.totalContributions);
    const summed = Object.values(heatmap).reduce((a, b) => a + b, 0);
    const total = declaredTotal || summed;

    return { total, heatmap };
  } catch (error: unknown) {
    logger.warn({ login, error: String(error) }, "GitHub official GraphQL contribution fetch failed");
    return null;
  }
}
