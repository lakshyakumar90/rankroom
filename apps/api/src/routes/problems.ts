import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { authenticate, requireRole, optionalAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { createProblemSchema, createTestCaseSchema, bulkCreateTestCasesSchema, paginationSchema } from "@repo/validators";
import { LANGUAGE_IDS, pollResult, runBatch, submitToJudge0, toTestResult } from "../services/judge.service";
import { submissionQueue } from "../jobs/submissionWorker";
import { Role, type Verdict } from "@repo/types";
import { z } from "zod";

const router: ExpressRouter = Router();

const problemFiltersSchema = paginationSchema.extend({
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  tag: z.union([z.string(), z.array(z.string())]).optional(),
  search: z.string().optional(),
  status: z.enum(["solved", "attempted", "unsolved"]).optional(),
});

const runSchema = z.object({
  source_code: z.string().min(1),
  language: z.string().min(1),
  stdin: z.string().optional(),
});

const submitSchema = z.object({
  source_code: z.string().min(1),
  language: z.string().min(1),
});

const STARTER_SOLUTIONS: Record<string, Partial<Record<string, string>>> = {
  "two-sum-stream": {
    python: "def solve():\n    import sys\n    data = sys.stdin.read().strip().split()\n    if not data:\n        return\n    n = int(data[0])\n    nums = list(map(int, data[1:1 + n]))\n    target = int(data[1 + n])\n    seen = set()\n    for value in nums:\n        if target - value in seen:\n            print('YES')\n            return\n        seen.add(value)\n    print('NO')\n\nif __name__ == '__main__':\n    solve()\n",
    javascript: "const fs = require('fs');\nconst tokens = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);\nif (tokens.length) {\n  const n = Number(tokens[0]);\n  const nums = tokens.slice(1, 1 + n).map(Number);\n  const target = Number(tokens[1 + n]);\n  const seen = new Set();\n  let ok = false;\n  for (const value of nums) {\n    if (seen.has(target - value)) { ok = true; break; }\n    seen.add(value);\n  }\n  process.stdout.write(ok ? 'YES' : 'NO');\n}\n",
    cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  int n;\n  if (!(cin >> n)) return 0;\n  vector<int> nums(n);\n  for (int i = 0; i < n; ++i) cin >> nums[i];\n  int target;\n  cin >> target;\n  unordered_set<int> seen;\n  for (int value : nums) {\n    if (seen.count(target - value)) {\n      cout << \"YES\";\n      return 0;\n    }\n    seen.insert(value);\n  }\n  cout << \"NO\";\n  return 0;\n}\n",
  },
  "section-leaderboard-rank-delta": {
    python: "def solve():\n    import sys\n    data = sys.stdin.read().strip().split()\n    if not data:\n        return\n    n = int(data[0])\n    scores = list(map(int, data[1:1 + n]))\n    ranked = sorted(enumerate(scores), key=lambda item: (-item[1], item[0]))\n    answer = [0] * n\n    for rank, (index, _) in enumerate(ranked, start=1):\n        answer[index] = rank\n    print(*answer)\n\nif __name__ == '__main__':\n    solve()\n",
    javascript: "const fs = require('fs');\nconst tokens = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);\nif (tokens.length) {\n  const n = Number(tokens[0]);\n  const scores = tokens.slice(1, 1 + n).map(Number);\n  const ranked = scores.map((score, index) => ({ score, index })).sort((a, b) => (b.score - a.score) || (a.index - b.index));\n  const answer = Array(n).fill(0);\n  ranked.forEach((item, rank) => { answer[item.index] = rank + 1; });\n  process.stdout.write(answer.join(' '));\n}\n",
    cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  int n;\n  if (!(cin >> n)) return 0;\n  vector<pair<int, int>> ranked;\n  for (int i = 0; i < n; ++i) {\n    int score;\n    cin >> score;\n    ranked.push_back({score, i});\n  }\n  sort(ranked.begin(), ranked.end(), [](const auto& a, const auto& b) {\n    if (a.first != b.first) return a.first > b.first;\n    return a.second < b.second;\n  });\n  vector<int> answer(n);\n  for (int i = 0; i < n; ++i) answer[ranked[i].second] = i + 1;\n  for (int i = 0; i < n; ++i) {\n    if (i) cout << ' ';\n    cout << answer[i];\n  }\n  return 0;\n}\n",
  },
};

// GET /api/problems
router.get("/", optionalAuth, validate(problemFiltersSchema, "query"), async (req, res, next) => {
  try {
    const { page, limit, difficulty, tag, search, status } = req.query as {
      page: string; limit: string; difficulty?: string; tag?: string | string[]; search?: string; status?: string;
    };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const tagFilters = typeof tag === "string" ? [tag] : (tag ?? []);

    const where = {
      isPublished: true,
      ...(difficulty ? { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" } : {}),
      ...(tagFilters.length > 0 ? { AND: tagFilters.map((tagValue) => ({ tags: { has: tagValue } })) } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { tags: { has: search } }] } : {}),
    };

    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where,
        select: {
          id: true, title: true, slug: true, difficulty: true, tags: true,
          points: true, createdAt: true,
          _count: { select: { submissions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.problem.count({ where }),
    ]);

    // If user is authenticated, mark solved status
    let solvedSet = new Set<string>();
    if (req.user) {
      const solved = await prisma.submission.findMany({
        where: { userId: req.user.id, status: "ACCEPTED", problemId: { in: problems.map((p) => p.id) } },
        select: { problemId: true },
        distinct: ["problemId"],
      });
      solvedSet = new Set(solved.map((s) => s.problemId));
    }

    let attemptedSet = new Set<string>();
    if (req.user) {
      const attempted = await prisma.submission.findMany({
        where: { userId: req.user.id, problemId: { in: problems.map((p) => p.id) } },
        select: { problemId: true },
        distinct: ["problemId"],
      });
      attemptedSet = new Set(attempted.map((submission) => submission.problemId));
    }

    const acceptanceRateMap = new Map<string, { accepted: number; total: number }>();
    if (problems.length > 0) {
      const grouped = await prisma.submission.groupBy({
        by: ["problemId", "status"],
        where: { problemId: { in: problems.map((problem) => problem.id) } },
        _count: true,
      });

      for (const row of grouped) {
        const current = acceptanceRateMap.get(row.problemId) ?? { accepted: 0, total: 0 };
        current.total += row._count;
        if (row.status === "ACCEPTED") current.accepted += row._count;
        acceptanceRateMap.set(row.problemId, current);
      }
    }

    const withStatus = problems
      .map((problem, index) => {
        const counts = acceptanceRateMap.get(problem.id) ?? { accepted: 0, total: 0 };
        const userStatus = solvedSet.has(problem.id) ? "solved" : attemptedSet.has(problem.id) ? "attempted" : "unsolved";
        return {
          ...problem,
          number: skip + index + 1,
          acceptanceRate: counts.total > 0 ? Math.round((counts.accepted / counts.total) * 1000) / 10 : 0,
          userStatus,
        };
      })
      .filter((problem) => !status || problem.userStatus === status);

    res.json({
      success: true,
      data: withStatus,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/run", authenticate, validate(runSchema), async (req, res, next) => {
  try {
    const { source_code, language, stdin } = req.body as { source_code: string; language: string; stdin?: string };
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) throw new AppError("Unsupported language", 400);

    const problem = await prisma.problem.findUnique({
      where: { id: req.params.id },
      include: {
        testCases: {
          where: stdin ? undefined : { isSample: true },
          orderBy: { createdAt: "asc" },
          take: stdin ? undefined : 3,
        },
      },
    });

    if (!problem || !problem.isPublished) throw new AppError("Problem not found", 404);

    if (stdin !== undefined) {
      const token = await submitToJudge0(source_code, languageId, stdin);
      const result = await pollResult(token);
      res.json({
        success: true,
        data: {
          results: [toTestResult(result, 0, null)],
        },
      });
      return;
    }

    const sampleCases = problem.testCases.filter((testCase) => testCase.isSample);
    const batchResults = await runBatch(
      source_code,
      languageId,
      sampleCases.map((testCase) => ({
        input: testCase.input,
        expected_output: testCase.expectedOutput,
      }))
    );

    res.json({
      success: true,
      data: {
        results: batchResults.map((result, index) => toTestResult(result, index, sampleCases[index]?.expectedOutput ?? null)),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/submit", authenticate, validate(submitSchema), async (req, res, next) => {
  try {
    const { source_code, language } = req.body as { source_code: string; language: string };
    const problem = await prisma.problem.findUnique({ where: { id: req.params.id } });
    if (!problem || !problem.isPublished) throw new AppError("Problem not found", 404);

    const submission = await prisma.submission.create({
      data: {
        userId: req.user!.id,
        problemId: req.params.id,
        code: source_code,
        language,
        status: "PENDING",
      },
    });

    await submissionQueue.add("submission" as const, {
      submissionId: submission.id,
      userId: req.user!.id,
      problemId: req.params.id,
      source_code,
      language,
    });

    res.status(201).json({ success: true, data: { submissionId: submission.id } });
  } catch (err) {
    next(err);
  }
});

// GET /api/problems/:idOrSlug
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const contestId = typeof req.query.contestId === "string" ? req.query.contestId : null;
    const problem = await prisma.problem.findFirst({
      where: {
        OR: [{ id: req.params.id }, { slug: req.params.id }],
      },
      include: {
        testCases: {
          where: { isSample: true },
          select: { id: true, input: true, expectedOutput: true, isSample: true },
        },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (!problem || (!problem.isPublished && req.user?.role === "STUDENT")) {
      throw new AppError("Problem not found", 404);
    }

    let contestContext: {
      contestId: string;
      points: number;
      hasAttempted: boolean;
      hasAccepted: boolean;
      isRegistered: boolean;
      status: "UPCOMING" | "LIVE" | "ENDED";
      endTime: string;
    } | null = null;

    if (contestId) {
      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        include: {
          audience: req.user ? { where: { studentId: req.user.id }, select: { studentId: true } } : false,
          problems: {
            where: { problemId: problem.id },
            select: { points: true },
          },
        },
      });

      if (!contest || contest.problems.length === 0) {
        throw new AppError("Contest problem not found", 404);
      }

      if (req.user?.role === "STUDENT") {
        if (contest.sectionId && !req.user.scope.sectionIds.includes(contest.sectionId)) {
          throw new AppError("Contest problem not found", 404);
        }

        const audienceCount = await prisma.contestAudience.count({ where: { contestId } });
        if (audienceCount > 0 && contest.audience.length === 0) {
          throw new AppError("Contest problem not found", 404);
        }
      }

      const registration = req.user
        ? await prisma.contestRegistration.findUnique({
            where: { contestId_userId: { contestId, userId: req.user.id } },
          })
        : null;

      const priorContestSubmissions = req.user
        ? await prisma.submission.findMany({
            where: { contestId, problemId: problem.id, userId: req.user.id },
            select: { status: true },
          })
        : [];

      contestContext = {
        contestId,
        points: contest.problems[0]?.points ?? problem.points,
        hasAttempted: priorContestSubmissions.length > 0,
        hasAccepted: priorContestSubmissions.some((entry) => entry.status === "ACCEPTED"),
        isRegistered: !!registration,
        status: contest.status,
        endTime: contest.endTime.toISOString(),
      };
    }

    const [acceptedCount, totalCount] = await Promise.all([
      prisma.submission.count({ where: { problemId: problem.id, status: "ACCEPTED" } }),
      prisma.submission.count({ where: { problemId: problem.id } }),
    ]);

    const submissionSummary = req.user
      ? await prisma.submission.groupBy({
          by: ["status"],
          where: { userId: req.user.id, problemId: problem.id },
          _count: true,
        })
      : [];

    res.json({
      success: true,
      data: {
        ...problem,
        acceptanceRate: totalCount > 0 ? Math.round((acceptedCount / totalCount) * 1000) / 10 : 0,
        acceptedCount,
        totalCount,
        hints: [],
        companies: [],
        starterCode: STARTER_SOLUTIONS[problem.slug] ?? {},
        contestContext,
        userStatus: submissionSummary.some((entry) => entry.status === "ACCEPTED")
          ? ("solved" satisfies "solved" | "attempted" | "unsolved")
          : submissionSummary.length > 0
            ? ("attempted" satisfies "solved" | "attempted" | "unsolved")
            : ("unsolved" satisfies "solved" | "attempted" | "unsolved"),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/problems - create problem (admin/teacher)
router.post("/", authenticate, requirePermission("problems:create"), validate(createProblemSchema), async (req, res, next) => {
  try {
    const problem = await prisma.problem.create({
      data: { ...req.body, createdById: req.user!.id },
    });
    res.status(201).json({ success: true, data: problem });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/problems/:id
router.patch("/:id", authenticate, requirePermission("problems:create"), async (req, res, next) => {
  try {
    const problem = await prisma.problem.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: problem });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/problems/:id
router.delete("/:id", authenticate, requirePermission("problems:delete"), async (req, res, next) => {
  try {
    await prisma.problem.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Problem deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /api/problems/:id/test-cases - add test cases
router.post("/:id/test-cases", authenticate, requireRole(Role.ADMIN, Role.TEACHER), validate(bulkCreateTestCasesSchema), async (req, res, next) => {
  try {
    const { testCases } = req.body as { testCases: { input: string; expectedOutput: string; isSample: boolean; isHidden: boolean }[] };
    const created = await prisma.testCase.createMany({
      data: testCases.map((tc) => ({ ...tc, problemId: req.params.id })),
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// GET /api/problems/:id/test-cases - list test cases (admin/teacher)
router.get("/:id/test-cases", authenticate, requireRole(Role.ADMIN, Role.TEACHER), async (req, res, next) => {
  try {
    const testCases = await prisma.testCase.findMany({ where: { problemId: req.params.id } });
    res.json({ success: true, data: testCases });
  } catch (err) {
    next(err);
  }
});

// POST /api/problems/:id/ai-hint - AI analysis via OpenRouter
router.post("/:id/ai-hint", authenticate, async (req, res, next) => {
  try {
    const { code, language, problemTitle, problemDescription } = req.body as {
      code: string;
      language: string;
      problemTitle: string;
      problemDescription: string;
    };

    if (!code || !language) {
      throw new AppError("code and language are required", 400);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new AppError("AI service not configured", 503);
    }

    const systemPrompt = `You are an expert competitive programmer and coding interview coach.
Analyze the user's code for a programming problem and provide:
1. **Optimal Approach**: Suggest the best algorithm/data structure for this problem
2. **Time Complexity**: Big-O time complexity of the optimal solution
3. **Space Complexity**: Big-O space complexity of the optimal solution
4. **Dry Run**: Step-by-step trace with a small example showing how the optimal solution works
5. **Explanation**: Clear explanation of why this approach is optimal

Format your response as valid JSON matching this schema:
{
  "optimalApproach": "description of optimal approach",
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "dryRun": "step by step dry run with example",
  "explanation": "detailed explanation",
  "issues": "any issues found in the submitted code (optional)"
}`;

    const userPrompt = `Problem: ${problemTitle}
Description: ${problemDescription.slice(0, 500)}

User's ${language} code:
\`\`\`${language}
${code.slice(0, 2000)}
\`\`\`

Analyze this and provide the optimal solution details in JSON format.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://rankroom.app",
        "X-Title": "RankRoom AI Assistant",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "google/gemini-flash-1.5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", errorText);
      throw new AppError("AI service error", 502);
    }

    const aiResponse = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) throw new AppError("Empty AI response", 502);

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(content) as Record<string, string>;
    } catch {
      parsed = { explanation: content, optimalApproach: "", timeComplexity: "Unknown", spaceComplexity: "Unknown", dryRun: "" };
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    next(err);
  }
});

// GET /api/problems/:id/submissions - own submissions for this problem
router.get("/:id/submissions", authenticate, async (req, res, next) => {
  try {
    const contestId = typeof req.query.contestId === "string" ? req.query.contestId : undefined;
    const submissions = await prisma.submission.findMany({
      where: {
        problemId: req.params.id,
        userId: req.user!.id,
        ...(contestId ? { contestId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({
      success: true,
      data: submissions.map((submission) => ({
        ...submission,
        verdictLabel:
          submission.status === "ACCEPTED"
            ? ("AC" satisfies Verdict)
            : submission.status === "WRONG_ANSWER"
              ? ("WA" satisfies Verdict)
              : submission.status === "TIME_LIMIT_EXCEEDED"
                ? ("TLE" satisfies Verdict)
                : submission.status === "MEMORY_LIMIT_EXCEEDED"
                  ? ("MLE" satisfies Verdict)
                  : submission.status === "COMPILATION_ERROR"
                    ? ("CE" satisfies Verdict)
                    : submission.status === "RUNTIME_ERROR"
                      ? ("RE" satisfies Verdict)
                      : ("JUDGING" satisfies Verdict),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
