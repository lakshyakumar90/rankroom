import { prisma } from "@repo/database";

/**
 * Tokenize source code for comparison:
 * - Strips comments, string literals, and whitespace
 * - Extracts meaningful language tokens (keywords, operators, identifiers)
 */
function tokenize(code: string): string[] {
  return code
    .replace(/\/\/[^\n]*/g, " ") // strip single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, " ") // strip block comments
    .replace(/#[^\n]*/g, " ") // strip Python/shell comments
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "STR") // normalize strings
    .replace(/\d+(\.\d+)?/g, "NUM") // normalize numbers
    .split(/[\s,;{}()\[\].<>!@$%^&*\-+=|?:/\\~]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Compute token-based Jaccard similarity between two code strings.
 * Returns a value between 0 (no overlap) and 1 (identical tokens).
 */
function jaccardSimilarity(codeA: string, codeB: string): number {
  const tokensA = new Set(tokenize(codeA));
  const tokensB = new Set(tokenize(codeB));

  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);

  return intersection.size / union.size;
}

/**
 * Compute n-gram based similarity for more robust detection of
 * structurally similar code (rearranged blocks, variable renaming, etc.)
 */
function ngramSimilarity(codeA: string, codeB: string, n = 3): number {
  const tokens = (code: string) => tokenize(code);
  const makeNgrams = (toks: string[]) => {
    const grams = new Set<string>();
    for (let i = 0; i <= toks.length - n; i++) {
      grams.add(toks.slice(i, i + n).join("|"));
    }
    return grams;
  };

  const gramsA = makeNgrams(tokens(codeA));
  const gramsB = makeNgrams(tokens(codeB));

  if (gramsA.size === 0 && gramsB.size === 0) return 1;
  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  const intersection = [...gramsA].filter((g) => gramsB.has(g)).length;
  const union = gramsA.size + gramsB.size - intersection;

  return intersection / union;
}

/**
 * Combined similarity score: average of Jaccard and n-gram similarity
 */
function combinedSimilarity(codeA: string, codeB: string): number {
  return (jaccardSimilarity(codeA, codeB) + ngramSimilarity(codeA, codeB)) / 2;
}

export interface PlagiarismPair {
  userA: { id: string; name: string };
  userB: { id: string; name: string };
  submissionAId: string;
  submissionBId: string;
  similarity: number;
  language: string;
  problemId: string;
}

/**
 * Run plagiarism detection for a contest.
 * Compares all accepted submissions for each problem, flagging pairs with
 * similarity >= threshold (default 0.75).
 */
export async function detectContestPlagiarism(
  contestId: string,
  threshold = 0.75
): Promise<PlagiarismPair[]> {
  const submissions = await prisma.submission.findMany({
    where: { contestId, status: "ACCEPTED" },
    select: {
      id: true,
      userId: true,
      code: true,
      language: true,
      problemId: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by problemId+language for apples-to-apples comparison
  const groups = new Map<string, typeof submissions>();
  for (const sub of submissions) {
    const key = `${sub.problemId}::${sub.language}`;
    const group = groups.get(key) ?? [];
    group.push(sub);
    groups.set(key, group);
  }

  const flaggedPairs: PlagiarismPair[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const subA = group[i]!;
        const subB = group[j]!;

        if (subA.userId === subB.userId) continue;

        const similarity = combinedSimilarity(subA.code, subB.code);

        if (similarity >= threshold) {
          flaggedPairs.push({
            userA: subA.user,
            userB: subB.user,
            submissionAId: subA.id,
            submissionBId: subB.id,
            similarity: Math.round(similarity * 100) / 100,
            language: subA.language,
            problemId: subA.problemId,
          });
        }
      }
    }
  }

  // Sort by similarity descending
  return flaggedPairs.sort((a, b) => b.similarity - a.similarity);
}
