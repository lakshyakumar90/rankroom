import { Router, type Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";
import { prisma, Prisma } from "@repo/database";
import { authenticate, requireRole, optionalAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { createProblemSchema, createTestCaseSchema, bulkCreateTestCasesSchema, paginationSchema } from "@repo/validators";
import { runBatch, toTestResult } from "../services/judge.service";
import { executeSubmissionCases, normalizeExecutionSource } from "../services/execution.service";
import { generateHint, getAiAssist } from "../services/ai-assist.service";
import { submissionQueue } from "../jobs/submissionWorker";
import { Role, type Verdict } from "@repo/types";
import { z } from "zod";
import { getJudge0LanguageId } from "../lib/judge0-languages";
import {
  mapScopeToVisibility,
  mapVisibilityToScope,
  normalizeBoilerplates,
  normalizeTagRefs,
} from "../lib/problem-normalization";
import {
  byteLengthUtf8,
  MAX_SOURCE_CODE_BYTES,
  MAX_STDIN_BYTES,
  MAX_TEST_CASES_PER_RUN,
  MAX_TEST_CASES_PER_SUBMIT,
} from "../config/execution";

const router: ExpressRouter = Router();

const submissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.socket.remoteAddress ?? "unknown",
  message: { success: false, error: "Too many submissions, please wait before trying again" },
});

const problemFiltersSchema = paginationSchema.extend({
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  tag: z.union([z.string(), z.array(z.string())]).optional(),
  search: z.string().optional(),
  status: z.enum(["solved", "attempted", "unsolved"]).optional(),
  visibility: z.enum(["GLOBAL", "DEPARTMENT", "CLASS", "CONTEST_ONLY", "ASSIGNMENT_ONLY"]).optional(),
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

const ALLOWED_PROBLEM_LANGUAGES = ["python", "cpp", "c"] as const;
const SUPPORTED_PROBLEM_LANGUAGES = [...ALLOWED_PROBLEM_LANGUAGES];

function isAllowedProblemLanguage(language: string): language is (typeof ALLOWED_PROBLEM_LANGUAGES)[number] {
  return ALLOWED_PROBLEM_LANGUAGES.includes(language as (typeof ALLOWED_PROBLEM_LANGUAGES)[number]);
}

const boilerplateUpsertSchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1),
});

function enforceSourceAndInputLimits(sourceCode: string, stdin?: string) {
  if (byteLengthUtf8(sourceCode) > MAX_SOURCE_CODE_BYTES) {
    throw new AppError(`source_code exceeds ${MAX_SOURCE_CODE_BYTES} bytes`, 400);
  }

  if (stdin !== undefined && byteLengthUtf8(stdin) > MAX_STDIN_BYTES) {
    throw new AppError(`stdin exceeds ${MAX_STDIN_BYTES} bytes`, 400);
  }
}

const STARTER_SOLUTIONS: Record<string, Partial<Record<string, string>>> = {
  "two-sum-stream": {
    python: "def solve():\n    import sys\n    data = sys.stdin.read().strip().split()\n    if not data:\n        return\n    n = int(data[0])\n    nums = list(map(int, data[1:1 + n]))\n    target = int(data[1 + n])\n    seen = set()\n    for value in nums:\n        if target - value in seen:\n            print('YES')\n            return\n        seen.add(value)\n    print('NO')\n\nif __name__ == '__main__':\n    solve()\n",
    cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  int n;\n  if (!(cin >> n)) return 0;\n  vector<int> nums(n);\n  for (int i = 0; i < n; ++i) cin >> nums[i];\n  int target;\n  cin >> target;\n  unordered_set<int> seen;\n  for (int value : nums) {\n    if (seen.count(target - value)) {\n      cout << \"YES\";\n      return 0;\n    }\n    seen.insert(value);\n  }\n  cout << \"NO\";\n  return 0;\n}\n",
  },
  "section-leaderboard-rank-delta": {
    python: "def solve():\n    import sys\n    data = sys.stdin.read().strip().split()\n    if not data:\n        return\n    n = int(data[0])\n    scores = list(map(int, data[1:1 + n]))\n    ranked = sorted(enumerate(scores), key=lambda item: (-item[1], item[0]))\n    answer = [0] * n\n    for rank, (index, _) in enumerate(ranked, start=1):\n        answer[index] = rank\n    print(*answer)\n\nif __name__ == '__main__':\n    solve()\n",
    cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  int n;\n  if (!(cin >> n)) return 0;\n  vector<pair<int, int>> ranked;\n  for (int i = 0; i < n; ++i) {\n    int score;\n    cin >> score;\n    ranked.push_back({score, i});\n  }\n  sort(ranked.begin(), ranked.end(), [](const auto& a, const auto& b) {\n    if (a.first != b.first) return a.first > b.first;\n    return a.second < b.second;\n  });\n  vector<int> answer(n);\n  for (int i = 0; i < n; ++i) answer[ranked[i].second] = i + 1;\n  for (int i = 0; i < n; ++i) {\n    if (i) cout << ' ';\n    cout << answer[i];\n  }\n  return 0;\n}\n",
  },
};

// GET /api/problems
router.get("/", optionalAuth, validate(problemFiltersSchema, "query"), async (req, res, next) => {
  try {
    const { page, limit, difficulty, tag, search, status, visibility } = req.query as {
      page: string; limit: string; difficulty?: string; tag?: string | string[]; search?: string; status?: string; visibility?: string;
    };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const tagFilters = typeof tag === "string" ? [tag] : (tag ?? []);

    // Build visibility filter based on user scope
    const buildVisibilityFilter = () => {
      const user = req.user;

      // Staff can see all published problems
      if (user && ["ADMIN", "SUPER_ADMIN", "DEPARTMENT_HEAD", "CLASS_COORDINATOR", "TEACHER"].includes(user.role)) {
        return {};
      }

      if (!user) {
        return { visibility: "GLOBAL" as const };
      }

      // Students see GLOBAL + their department's + their class's problems
      return {
        OR: [
          { visibility: "GLOBAL" as const, approvalStatus: "APPROVED" as const },
          {
            visibility: "DEPARTMENT" as const,
            departmentId: { in: user.scope.departmentIds },
          },
          {
            visibility: "CLASS" as const,
            classId: { in: user.scope.sectionIds },
          },
        ],
      };
    };

    const visibilityFilter = visibility
      ? { visibility: visibility as "GLOBAL" | "DEPARTMENT" | "CLASS" }
      : buildVisibilityFilter();

    const where = {
      isPublished: true,
      ...visibilityFilter,
      ...(difficulty ? { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" } : {}),
      ...(tagFilters.length > 0 ? { AND: tagFilters.map((tagValue) => ({ tags: { has: tagValue } })) } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { tags: { has: search } }] } : {}),
    };

    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where,
        select: {
          id: true, title: true, slug: true, difficulty: true, tags: true,
          visibility: true,
          scope: true,
          createdBy: { select: { id: true, name: true } },
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
          scope: problem.scope ?? mapVisibilityToScope(problem.visibility),
          normalizedTags: normalizeTagRefs(problem.tags),
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

router.post("/:id/run", authenticate, submissionLimiter, validate(runSchema), async (req, res, next) => {
  try {
    const { source_code, language, stdin } = req.body as { source_code: string; language: string; stdin?: string };
    if (!isAllowedProblemLanguage(language)) {
      throw new AppError("Only C, C++, and Python are supported", 400);
    }
    enforceSourceAndInputLimits(source_code, stdin);

    const normalizedExecution = normalizeExecutionSource(language, source_code);
    const languageId = await getJudge0LanguageId(normalizedExecution.effectiveLanguage);
    if (!languageId) throw new AppError("Unsupported language", 400);

    const problem = await prisma.problem.findUnique({
      where: { id: req.params.id },
      include: {
        testCases: {
          where: { isSample: true },
          orderBy: { createdAt: "asc" },
          take: 3,
        },
      },
    });

    if (!problem || !problem.isPublished) throw new AppError("Problem not found", 404);

    const shouldUseWrappedExecution =
      !!problem.functionName &&
      !!problem.returnType &&
      Array.isArray(problem.parameterTypes) &&
      problem.parameterTypes.length > 0 &&
      isAllowedProblemLanguage(language);

    // Custom stdin mode — run against user-provided input only
    if (stdin !== undefined && stdin !== "") {
      if (shouldUseWrappedExecution) {
        try {
          JSON.parse(stdin);
        } catch {
          throw new AppError(
            "For wrapped problems, custom input must be a JSON object (example: {\"nums\":[2,7,11,15],\"target\":9}).",
            400
          );
        }

        const summary = await executeSubmissionCases({
          problem: {
            id: problem.id,
            functionName: problem.functionName,
            parameterTypes: problem.parameterTypes,
            returnType: problem.returnType,
            compareMode: problem.compareMode as "EXACT" | "UNORDERED" | "FLOAT_TOLERANCE" | "IGNORE_TRAILING_WHITESPACE",
            timeLimitMs: problem.timeLimitMs,
            memoryLimitKb: problem.memoryLimitKb,
          },
          userCode: source_code,
          language,
          testCases: [{ input: stdin, expectedOutput: "", isHidden: false }],
          skipComparison: true,
        });

        res.json({
          success: true,
          data: {
            results: summary.results,
            execution: {
              supportedLanguages: SUPPORTED_PROBLEM_LANGUAGES,
            },
          },
        });
        return;
      }

      const [result] = await runBatch(normalizedExecution.effectiveUserCode, languageId, [
        { input: stdin },
      ]);
      res.json({
        success: true,
        data: {
          results: [toTestResult(result, 0, null)],
          execution: {
            supportedLanguages: SUPPORTED_PROBLEM_LANGUAGES,
          },
        },
      });
      return;
    }

    const sampleCases = problem.testCases.filter((testCase) => testCase.isSample);
    if (sampleCases.length > MAX_TEST_CASES_PER_RUN) {
      throw new AppError(`Too many sample test cases configured. Maximum allowed is ${MAX_TEST_CASES_PER_RUN}`, 400);
    }

    if (shouldUseWrappedExecution && sampleCases.length > 0) {
      const summary = await executeSubmissionCases({
        problem: {
          id: problem.id,
          functionName: problem.functionName,
          parameterTypes: problem.parameterTypes,
          returnType: problem.returnType,
          compareMode: problem.compareMode as "EXACT" | "UNORDERED" | "FLOAT_TOLERANCE" | "IGNORE_TRAILING_WHITESPACE",
          timeLimitMs: problem.timeLimitMs,
          memoryLimitKb: problem.memoryLimitKb,
        },
        userCode: source_code,
        language,
        testCases: sampleCases.map((testCase) => ({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          isHidden: testCase.isHidden,
        })),
      });

      res.json({
        success: true,
        data: {
          results: summary.results.map((result) => ({
            caseIndex: result.caseIndex,
            verdict: result.verdict,
            stdout: result.stdout,
            expected: result.expected,
            stderr: result.stderr,
            compileOutput: result.compileOutput,
            runtime: result.runtime,
            memory: result.memory,
            passed: result.passed,
          })),
          execution: {
            supportedLanguages: SUPPORTED_PROBLEM_LANGUAGES,
          },
        },
      });
      return;
    }

    if (sampleCases.length === 0) {
      // No sample cases — run with empty stdin so the user still gets output
      const [result] = await runBatch(normalizedExecution.effectiveUserCode, languageId, [
        { input: "" },
      ]);
      res.json({
        success: true,
        data: {
          results: [toTestResult(result, 0, null)],
          execution: {
            supportedLanguages: SUPPORTED_PROBLEM_LANGUAGES,
          },
        },
      });
      return;
    }

    const judgeResults = await runBatch(
      normalizedExecution.effectiveUserCode,
      languageId,
      sampleCases.map((testCase) => ({
        input: testCase.input,
        expected_output: testCase.expectedOutput,
      }))
    );

    res.json({
      success: true,
      data: {
        results: judgeResults.map((result, index) =>
          toTestResult(result, index, sampleCases[index]?.expectedOutput ?? null)
        ),
        execution: {
          supportedLanguages: SUPPORTED_PROBLEM_LANGUAGES,
        },
      },
    });
  } catch (err) {
    // Surface Judge0 connectivity errors as 503, not generic 500/400
    if (err instanceof Error && err.message.includes("Judge0")) {
      return res.status(503).json({
        success: false,
        error: err.message.startsWith("Judge0 ")
          ? err.message
          : `Judge0 execution service error: ${err.message}`,
      });
    }
    next(err);
  }
});

router.post("/:id/submit", authenticate, submissionLimiter, validate(submitSchema), async (req, res, next) => {
  try {
    const { source_code, language } = req.body as { source_code: string; language: string };
    if (!isAllowedProblemLanguage(language)) {
      throw new AppError("Only C, C++, and Python are supported", 400);
    }
    enforceSourceAndInputLimits(source_code);

    const contestId = typeof req.query.contestId === "string" ? req.query.contestId : undefined;

    const problem = await prisma.problem.findUnique({ where: { id: req.params.id } });
    if (!problem || !problem.isPublished) throw new AppError("Problem not found", 404);

    const hiddenCount = await prisma.testCase.count({ where: { problemId: req.params.id, isHidden: true } });
    const effectiveCount = hiddenCount > 0
      ? hiddenCount
      : await prisma.testCase.count({ where: { problemId: req.params.id, isHidden: false } });

    if (effectiveCount > MAX_TEST_CASES_PER_SUBMIT) {
      throw new AppError(`Too many test cases configured. Maximum allowed is ${MAX_TEST_CASES_PER_SUBMIT}`, 400);
    }

    const submission = await prisma.submission.create({
      data: {
        userId: req.user!.id,
        problemId: req.params.id,
        code: source_code,
        language,
        status: "PENDING",
        ...(contestId ? { contestId } : {}),
      },
    });

    await submissionQueue.add("submission" as const, {
      submissionId: submission.id,
      userId: req.user!.id,
      problemId: req.params.id,
      source_code,
      language,
      ...(contestId ? { contestId } : {}),
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
        boilerplates: { select: { language: true, code: true }, orderBy: { language: "asc" } },
        hints: { select: { tier: true, content: true }, orderBy: { tier: "asc" } },
        editorial: {
          select: {
            summary: true,
            approach: true,
            complexity: true,
            fullEditorial: true,
          },
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
      status: string;
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
        hints: problem.hints.map((hint) => hint.content),
        editorial: problem.editorial,
        companies: [],
        starterCode: (problem.starterCode as Record<string, string> | null) ?? STARTER_SOLUTIONS[problem.slug] ?? {},
        boilerplates:
          problem.boilerplates.length > 0
            ? problem.boilerplates
            : normalizeBoilerplates(problem.starterCode).length > 0
              ? normalizeBoilerplates(problem.starterCode)
              : normalizeBoilerplates(STARTER_SOLUTIONS[problem.slug] ?? {}),
        normalizedTags: normalizeTagRefs(problem.tags),
        scope: problem.scope ?? mapVisibilityToScope(problem.visibility),
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

// GET /api/problems/:id/boilerplates - list language starter code
router.get("/:id/boilerplates", authenticate, async (req, res, next) => {
  try {
    const rows = await prisma.boilerplate.findMany({
      where: { problemId: req.params.id },
      select: { language: true, code: true },
      orderBy: { language: "asc" },
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/problems/:id/boilerplates - upsert starter code for a language
router.put("/:id/boilerplates", authenticate, requirePermission("problems:create"), validate(boilerplateUpsertSchema), async (req, res, next) => {
  try {
    const { language, code } = req.body as { language: string; code: string };

    const boilerplate = await prisma.boilerplate.upsert({
      where: { problemId_language: { problemId: req.params.id, language } },
      update: { code },
      create: { problemId: req.params.id, language, code },
    });

    res.json({ success: true, data: boilerplate });
  } catch (err) {
    next(err);
  }
});

// GET /api/problems/:id/hints/:level - progressive hint retrieval
router.get("/:id/hints/:level", authenticate, async (req, res, next) => {
  try {
    const level = Number.parseInt(req.params.level, 10);
    if (!Number.isFinite(level) || level < 1) {
      throw new AppError("Hint level must be a positive integer", 400);
    }

    const hint = await prisma.hint.findFirst({
      where: { problemId: req.params.id, tier: level },
      select: { id: true, tier: true, content: true },
    });

    if (!hint) {
      throw new AppError("Hint not found", 404);
    }

    res.json({ success: true, data: hint });
  } catch (err) {
    next(err);
  }
});

// GET /api/problems/:id/editorial
router.get("/:id/editorial", authenticate, async (req, res, next) => {
  try {
    const editorial = await prisma.editorial.findUnique({
      where: { problemId: req.params.id },
      select: {
        problemId: true,
        summary: true,
        approach: true,
        complexity: true,
        fullEditorial: true,
      },
    });

    if (!editorial) {
      throw new AppError("No editorial available", 404);
    }

    res.json({ success: true, data: editorial });
  } catch (err) {
    next(err);
  }
});

// GET /api/problems/pending-approval - admin/dept head approval queue
router.get("/pending-approval", authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "DEPARTMENT_HEAD"].includes(user.role)) {
      throw new AppError("Insufficient permissions", 403);
    }

    const where = user.role === "DEPARTMENT_HEAD"
      ? { approvalStatus: "PENDING" as const, visibility: "GLOBAL" as const, departmentId: { in: user.scope.departmentIds } }
      : { approvalStatus: "PENDING" as const, visibility: "GLOBAL" as const };

    const problems = await prisma.problem.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: problems });
  } catch (err) {
    next(err);
  }
});

// POST /api/problems/:id/approve
router.post("/:id/approve", authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "DEPARTMENT_HEAD"].includes(user.role)) {
      throw new AppError("Insufficient permissions", 403);
    }

    const problem = await prisma.problem.update({
      where: { id: req.params.id },
      data: { approvalStatus: "APPROVED", approvedById: user.id },
    });

    res.json({ success: true, data: problem });
  } catch (err) {
    next(err);
  }
});

// POST /api/problems/:id/reject
router.post("/:id/reject", authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "DEPARTMENT_HEAD"].includes(user.role)) {
      throw new AppError("Insufficient permissions", 403);
    }

    const problem = await prisma.problem.update({
      where: { id: req.params.id },
      data: { approvalStatus: "REJECTED" },
    });

    res.json({ success: true, data: problem });
  } catch (err) {
    next(err);
  }
});

// POST /api/problems - create problem (admin/teacher)
router.post("/", authenticate, requirePermission("problems:create"), validate(createProblemSchema), async (req, res, next) => {
  try {
    const {
      visibility,
      scope,
      scopeSectionId,
      scopeDepartmentId,
      classId,
      departmentId,
      subjectId,
      boilerplates = [],
      hints = [],
      editorial,
      tagIds = [],
      ...rest
    } = req.body as {
      visibility?: "GLOBAL" | "DEPARTMENT" | "CLASS" | "CONTEST_ONLY" | "ASSIGNMENT_ONLY";
      scope?: "GLOBAL" | "DEPARTMENT" | "SECTION";
      scopeSectionId?: string | null;
      scopeDepartmentId?: string | null;
      classId?: string | null;
      departmentId?: string | null;
      subjectId?: string | null;
      boilerplates?: Array<{ language: string; code: string }>;
      hints?: Array<{ tier?: number; content: string }>;
      editorial?: { summary?: string; approach?: string; complexity?: string; fullEditorial: string };
      tagIds?: string[];
      [key: string]: unknown;
    };
    const user = req.user!;

    const effectiveScope = scope ?? "GLOBAL";
    const effectiveVisibility = visibility ?? mapScopeToVisibility(effectiveScope);
    const effectiveClassId = classId ?? (effectiveScope === "SECTION" ? (scopeSectionId ?? null) : null);
    const effectiveDepartmentId =
      departmentId ?? (effectiveScope === "DEPARTMENT" ? (scopeDepartmentId ?? null) : null);

    // Auto-set approval status based on visibility and role
    let approvalStatus: "PENDING" | "APPROVED" = "APPROVED";
    if (
      effectiveVisibility === "GLOBAL" &&
      !["ADMIN", "SUPER_ADMIN", "DEPARTMENT_HEAD"].includes(user.role)
    ) {
      approvalStatus = "PENDING";
    }

    const problem = await prisma.$transaction(async (tx) => {
      const createData = {
        ...(rest as Prisma.ProblemUncheckedCreateInput),
        visibility: effectiveVisibility,
        scope: effectiveScope,
        scopeSectionId: scopeSectionId ?? effectiveClassId,
        scopeDepartmentId: scopeDepartmentId ?? effectiveDepartmentId,
        approvalStatus,
        classId: effectiveClassId,
        departmentId: effectiveDepartmentId,
        subjectId: subjectId ?? null,
        createdById: user.id,
      } as Prisma.ProblemUncheckedCreateInput;

      const created = await tx.problem.create({
        data: createData,
      });

      if (boilerplates.length > 0) {
        await tx.boilerplate.createMany({
          data: boilerplates.map((entry) => ({
            problemId: created.id,
            language: entry.language,
            code: entry.code,
          })),
          skipDuplicates: true,
        });
      }

      if (hints.length > 0) {
        await tx.hint.createMany({
          data: hints.map((entry, index) => ({
            problemId: created.id,
            tier: entry.tier ?? index + 1,
            content: entry.content,
          })),
          skipDuplicates: true,
        });
      }

      if (editorial) {
        await tx.editorial.upsert({
          where: { problemId: created.id },
          update: {
            summary: editorial.summary ?? null,
            approach: editorial.approach ?? null,
            complexity: editorial.complexity ?? null,
            fullEditorial: editorial.fullEditorial,
          },
          create: {
            problemId: created.id,
            summary: editorial.summary ?? null,
            approach: editorial.approach ?? null,
            complexity: editorial.complexity ?? null,
            fullEditorial: editorial.fullEditorial,
          },
        });
      }

      if (tagIds.length > 0) {
        await tx.problemTag.createMany({
          data: tagIds.map((tagId) => ({ problemId: created.id, tagId })),
          skipDuplicates: true,
        });
      }

      return created;
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
    const { code, language, hintLevel, problemTitle, problemDescription } = req.body as {
      code: string;
      language: string;
      hintLevel?: 1 | 2 | 3;
      problemTitle: string;
      problemDescription: string;
    };

    if (!code || !language) {
      throw new AppError("code and language are required", 400);
    }

    const problem = await prisma.problem.findUnique({
      where: { id: req.params.id },
      select: { title: true, description: true },
    });

    const resolvedProblemTitle = problem?.title ?? problemTitle ?? "Problem";
    const resolvedProblemDescription = problem?.description ?? problemDescription ?? "";

    if (hintLevel !== undefined) {
      const hint = await generateHint({
        problemTitle: resolvedProblemTitle,
        problemDescription: resolvedProblemDescription,
        code,
        language,
        hintLevel,
      });

      return res.json({ success: true, data: { hint, hintLevel } });
    }

    const response = await getAiAssist({
      code,
      language,
      problemTitle: resolvedProblemTitle,
      problemDescription: resolvedProblemDescription,
    });

    res.json({ success: true, data: response.result });
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
