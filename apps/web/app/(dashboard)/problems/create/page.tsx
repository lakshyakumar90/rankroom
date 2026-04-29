"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Role, type ApiResponse } from "@repo/types";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface SectionOption {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  department?: { id: string; name: string; code: string };
}

interface ProblemResponse {
  id: string;
  slug: string;
}

interface TestCaseForm {
  input: string;
  expectedOutput: string;
  isSample: boolean;
  isHidden: boolean;
}

const EMPTY_TEST_CASE: TestCaseForm = {
  input: "",
  expectedOutput: "",
  isSample: true,
  isHidden: false,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

export default function CreateProblemPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const canCreate = user ? hasPermission(user.role, "problems:create") : false;

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("EASY");
  const [tags, setTags] = useState("arrays, implementation");
  const [scope, setScope] = useState<"GLOBAL" | "DEPARTMENT" | "SECTION">("GLOBAL");
  const [scopeDepartmentId, setScopeDepartmentId] = useState("");
  const [scopeSectionId, setScopeSectionId] = useState("");
  const [constraints, setConstraints] = useState("");
  const [inputFormat, setInputFormat] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [points, setPoints] = useState(100);
  const [isPublished, setIsPublished] = useState(true);
  const [starterCode, setStarterCode] = useState("class Solution:\n    def solve(self):\n        pass\n");
  const [testCases, setTestCases] = useState<TestCaseForm[]>([
    { ...EMPTY_TEST_CASE },
    { input: "", expectedOutput: "", isSample: false, isHidden: true },
  ]);

  const { data: departmentsData } = useQuery({
    queryKey: ["departments", "problem-create"],
    queryFn: () => api.get<ApiResponse<DepartmentOption[]>>("/api/departments"),
    enabled: canCreate,
  });

  const { data: sectionsData } = useQuery({
    queryKey: ["sections", "problem-create"],
    queryFn: () => api.get<ApiResponse<SectionOption[]>>("/api/sections"),
    enabled: canCreate,
  });

  const departments = departmentsData?.data ?? [];
  const sections = sectionsData?.data ?? [];
  const visibleSections = useMemo(
    () =>
      scopeDepartmentId
        ? sections.filter((section) => section.departmentId === scopeDepartmentId || section.department?.id === scopeDepartmentId)
        : sections,
    [scopeDepartmentId, sections]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!canCreate) throw new Error("You do not have permission to create problems");
      const finalSlug = slug || slugify(title);
      if (!finalSlug) throw new Error("Enter a valid title or slug");

      const validCases = testCases.filter((testCase) => testCase.input.trim() || testCase.expectedOutput.trim());
      if (validCases.length === 0) throw new Error("Add at least one test case");

      const created = await api.post<ApiResponse<ProblemResponse>>("/api/problems", {
        title: title.trim(),
        slug: finalSlug,
        description: description.trim(),
        difficulty,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 10),
        scope,
        scopeDepartmentId: scope === "DEPARTMENT" ? scopeDepartmentId || null : null,
        scopeSectionId: scope === "SECTION" ? scopeSectionId || null : null,
        constraints: constraints.trim() || undefined,
        inputFormat: inputFormat.trim() || undefined,
        outputFormat: outputFormat.trim() || undefined,
        points,
        isPublished,
        starterCode: starterCode.trim() ? { python: starterCode } : undefined,
        boilerplates: starterCode.trim() ? [{ language: "python", code: starterCode }] : [],
      });

      if (!created.data?.id) throw new Error("Problem was created but no id was returned");

      await api.post(`/api/problems/${created.data.id}/test-cases`, {
        testCases: validCases.map((testCase, index) => ({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          isSample: index === 0 ? true : testCase.isSample,
          isHidden: testCase.isHidden,
        })),
      });

      return created.data;
    },
    onSuccess: (problem) => {
      toast.success(isPublished ? "Problem published" : "Problem saved as draft");
      if (problem) router.push(`/problems/${problem.id}`);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create problem"),
  });

  if (user && !canCreate) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Only admins, department heads, class coordinators, and teachers can create problems.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" className="mb-2 px-0" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 size-4" />
            Back to problems
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Create problem</h1>
          <p className="text-sm text-muted-foreground">
            Staff can author problems here. Students can practice published problems from the Problems page.
          </p>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !title || !description}>
          {createMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
          Create problem
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Problem statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    if (!slug) setSlug(slugify(event.target.value));
                  }}
                  placeholder="Two Sum"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} placeholder="two-sum" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-40"
                placeholder="Describe the task, input, output, and examples."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Input format</Label>
                <Textarea value={inputFormat} onChange={(event) => setInputFormat(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Output format</Label>
                <Textarea value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Constraints</Label>
              <Textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Python starter code</Label>
              <Textarea
                value={starterCode}
                onChange={(event) => setStarterCode(event.target.value)}
                className="min-h-32 font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <select
                className="h-10 w-full rounded-2xl bg-input/50 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as "EASY" | "MEDIUM" | "HARD")}
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="arrays, dp, graphs" />
            </div>

            <div className="space-y-2">
              <Label>Points</Label>
              <Input type="number" min={1} value={points} onChange={(event) => setPoints(Number(event.target.value) || 1)} />
            </div>

            <div className="space-y-2">
              <Label>Scope</Label>
              <select
                className="h-10 w-full rounded-2xl bg-input/50 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as "GLOBAL" | "DEPARTMENT" | "SECTION");
                  setScopeDepartmentId("");
                  setScopeSectionId("");
                }}
              >
                <option value="GLOBAL">Global</option>
                <option value="DEPARTMENT">Department</option>
                <option value="SECTION">Section</option>
              </select>
            </div>

            {scope === "DEPARTMENT" ? (
              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  className="h-10 w-full rounded-2xl bg-input/50 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  value={scopeDepartmentId}
                  onChange={(event) => setScopeDepartmentId(event.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {scope === "SECTION" ? (
              <div className="space-y-2">
                <Label>Section</Label>
                <select
                  className="h-10 w-full rounded-2xl bg-input/50 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  value={scopeSectionId}
                  onChange={(event) => setScopeSectionId(event.target.value)}
                >
                  <option value="">Select section</option>
                  {visibleSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name} {section.department ? `· ${section.department.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
              Publish immediately
            </label>

            {user?.role === Role.TEACHER && scope === "GLOBAL" ? (
              <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-600">
                Global teacher problems are sent for approval. Use section scope to publish directly for your class.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {testCases.map((testCase, index) => (
            <div key={index} className="rounded-2xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Case {index + 1}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTestCases((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  disabled={testCases.length <= 1}
                >
                  <Trash2 className="mr-2 size-4" />
                  Remove
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Input</Label>
                  <Textarea
                    className="min-h-24 font-mono text-sm"
                    value={testCase.input}
                    onChange={(event) =>
                      setTestCases((current) =>
                        current.map((item, itemIndex) => itemIndex === index ? { ...item, input: event.target.value } : item)
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected output</Label>
                  <Textarea
                    className="min-h-24 font-mono text-sm"
                    value={testCase.expectedOutput}
                    onChange={(event) =>
                      setTestCases((current) =>
                        current.map((item, itemIndex) => itemIndex === index ? { ...item, expectedOutput: event.target.value } : item)
                      )
                    }
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={testCase.isSample}
                    onChange={(event) =>
                      setTestCases((current) =>
                        current.map((item, itemIndex) => itemIndex === index ? { ...item, isSample: event.target.checked } : item)
                      )
                    }
                  />
                  Show as sample
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={testCase.isHidden}
                    onChange={(event) =>
                      setTestCases((current) =>
                        current.map((item, itemIndex) => itemIndex === index ? { ...item, isHidden: event.target.checked } : item)
                      )
                    }
                  />
                  Hidden judge case
                </label>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={() => setTestCases((current) => [...current, { input: "", expectedOutput: "", isSample: false, isHidden: true }])}
          >
            <Plus className="mr-2 size-4" />
            Add test case
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
