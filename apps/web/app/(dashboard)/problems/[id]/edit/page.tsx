"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ApiResponse } from "@repo/types";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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

interface ProblemDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  scope?: "GLOBAL" | "DEPARTMENT" | "SECTION";
  scopeDepartmentId?: string | null;
  scopeSectionId?: string | null;
  constraints?: string | null;
  inputFormat?: string | null;
  outputFormat?: string | null;
  points: number;
  isPublished: boolean;
  createdBy?: { id: string; name: string } | null;
  starterCode?: Partial<Record<string, string>>;
  boilerplates?: Array<{ language: string; code: string }>;
}

interface TestCaseForm {
  id?: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  isHidden: boolean;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

export default function EditProblemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canCreate = user ? hasPermission(user.role, "problems:create") : false;
  const canManageAny = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [hydratedProblemId, setHydratedProblemId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("EASY");
  const [tags, setTags] = useState("");
  const [scope, setScope] = useState<"GLOBAL" | "DEPARTMENT" | "SECTION">("GLOBAL");
  const [scopeDepartmentId, setScopeDepartmentId] = useState("");
  const [scopeSectionId, setScopeSectionId] = useState("");
  const [constraints, setConstraints] = useState("");
  const [inputFormat, setInputFormat] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [points, setPoints] = useState(100);
  const [isPublished, setIsPublished] = useState(true);
  const [starterCode, setStarterCode] = useState("");
  const [testCases, setTestCases] = useState<TestCaseForm[]>([]);

  const { data: problemData, isLoading } = useQuery({
    queryKey: ["problem-detail", params.id, "edit"],
    queryFn: () => api.get<ApiResponse<ProblemDetail>>(`/api/problems/${params.id}`),
    enabled: !!params.id && canCreate,
  });

  const problem = problemData?.data;
  const canManage = !!problem && canCreate && (canManageAny || problem.createdBy?.id === user?.id);

  const { data: testCasesData } = useQuery({
    queryKey: ["problem-test-cases", params.id],
    queryFn: () => api.get<ApiResponse<TestCaseForm[]>>(`/api/problems/${params.id}/test-cases`),
    enabled: !!params.id && canManage,
  });

  const { data: departmentsData } = useQuery({
    queryKey: ["departments", "problem-edit"],
    queryFn: () => api.get<ApiResponse<DepartmentOption[]>>("/api/departments"),
    enabled: canManage,
  });

  const { data: sectionsData } = useQuery({
    queryKey: ["sections", "problem-edit"],
    queryFn: () => api.get<ApiResponse<SectionOption[]>>("/api/sections"),
    enabled: canManage,
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

  useEffect(() => {
    if (!problem || hydratedProblemId === problem.id) return;
    setHydratedProblemId(problem.id);
    setTitle(problem.title);
    setSlug(problem.slug);
    setDescription(problem.description);
    setDifficulty(problem.difficulty);
    setTags(problem.tags.join(", "));
    setScope(problem.scope ?? "GLOBAL");
    setScopeDepartmentId(problem.scopeDepartmentId ?? "");
    setScopeSectionId(problem.scopeSectionId ?? "");
    setConstraints(problem.constraints ?? "");
    setInputFormat(problem.inputFormat ?? "");
    setOutputFormat(problem.outputFormat ?? "");
    setPoints(problem.points);
    setIsPublished(problem.isPublished);
    setStarterCode(
      problem.boilerplates?.find((entry) => entry.language === "python")?.code ??
        problem.starterCode?.python ??
        ""
    );
  }, [hydratedProblemId, problem]);

  useEffect(() => {
    if (!testCasesData?.data) return;
    setTestCases(testCasesData.data);
  }, [testCasesData?.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!canManage) throw new Error("You can only edit problems you created");
      const validCases = testCases.filter((testCase) => testCase.input.trim() || testCase.expectedOutput.trim());
      if (validCases.length === 0) throw new Error("Keep at least one test case");

      await api.patch(`/api/problems/${problem!.id}`, {
        title: title.trim(),
        slug: slug || slugify(title),
        description: description.trim(),
        difficulty,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
        scope,
        scopeDepartmentId: scope === "DEPARTMENT" ? scopeDepartmentId || null : null,
        scopeSectionId: scope === "SECTION" ? scopeSectionId || null : null,
        constraints: constraints.trim() || null,
        inputFormat: inputFormat.trim() || null,
        outputFormat: outputFormat.trim() || null,
        points,
        isPublished,
        starterCode: starterCode.trim() ? { python: starterCode } : {},
        boilerplates: starterCode.trim() ? [{ language: "python", code: starterCode }] : [],
      });

      await api.put(`/api/problems/${problem!.id}/test-cases`, {
        testCases: validCases.map((testCase, index) => ({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          isSample: index === 0 ? true : testCase.isSample,
          isHidden: testCase.isHidden,
        })),
      });
    },
    onSuccess: () => {
      toast.success("Problem updated");
      void queryClient.invalidateQueries({ queryKey: ["problems"] });
      void queryClient.invalidateQueries({ queryKey: ["problem-detail", params.id] });
      router.push("/problems");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update problem"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!canManage) throw new Error("You can only delete problems you created");
      await api.delete(`/api/problems/${problem!.id}`);
    },
    onSuccess: () => {
      toast.success("Problem deleted");
      void queryClient.invalidateQueries({ queryKey: ["problems"] });
      router.push("/problems");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete problem"),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Admins can edit any problem. Teachers and staff can only edit problems they created.
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
          <h1 className="text-2xl font-semibold tracking-tight">Edit problem</h1>
          <p className="text-sm text-muted-foreground">{problem?.title}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm(`Delete "${problem?.title}"? This cannot be undone.`)) deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
            Delete
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !title || !description}>
            {saveMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>Problem statement</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-40" />
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
              <Textarea value={starterCode} onChange={(event) => setStarterCode(event.target.value)} className="min-h-32 font-mono text-sm" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <select className="h-10 w-full rounded-2xl bg-input/50 px-3 text-sm" value={difficulty} onChange={(event) => setDifficulty(event.target.value as "EASY" | "MEDIUM" | "HARD")}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input value={tags} onChange={(event) => setTags(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Points</Label>
              <Input type="number" min={1} value={points} onChange={(event) => setPoints(Number(event.target.value) || 1)} />
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <select className="h-10 w-full rounded-2xl bg-input/50 px-3 text-sm" value={scope} onChange={(event) => setScope(event.target.value as "GLOBAL" | "DEPARTMENT" | "SECTION")}>
                <option value="GLOBAL">Global</option>
                <option value="DEPARTMENT">Department</option>
                <option value="SECTION">Section</option>
              </select>
            </div>
            {scope === "DEPARTMENT" ? (
              <div className="space-y-2">
                <Label>Department</Label>
                <select className="h-10 w-full rounded-2xl bg-input/50 px-3 text-sm" value={scopeDepartmentId} onChange={(event) => setScopeDepartmentId(event.target.value)}>
                  <option value="">Select department</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </div>
            ) : null}
            {scope === "SECTION" ? (
              <div className="space-y-2">
                <Label>Section</Label>
                <select className="h-10 w-full rounded-2xl bg-input/50 px-3 text-sm" value={scopeSectionId} onChange={(event) => setScopeSectionId(event.target.value)}>
                  <option value="">Select section</option>
                  {visibleSections.map((section) => (
                    <option key={section.id} value={section.id}>{section.name}{section.department ? ` · ${section.department.name}` : ""}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
              Published
            </label>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Test cases</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {testCases.map((testCase, index) => (
            <div key={testCase.id ?? index} className="rounded-2xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Case {index + 1}</p>
                <Button variant="ghost" size="sm" onClick={() => setTestCases((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={testCases.length <= 1}>
                  <Trash2 className="mr-2 size-4" />
                  Remove
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Input</Label>
                  <Textarea className="min-h-24 font-mono text-sm" value={testCase.input} onChange={(event) => setTestCases((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, input: event.target.value } : item))} />
                </div>
                <div className="space-y-2">
                  <Label>Expected output</Label>
                  <Textarea className="min-h-24 font-mono text-sm" value={testCase.expectedOutput} onChange={(event) => setTestCases((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, expectedOutput: event.target.value } : item))} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={testCase.isSample} onChange={(event) => setTestCases((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, isSample: event.target.checked } : item))} />
                  Show as sample
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={testCase.isHidden} onChange={(event) => setTestCases((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, isHidden: event.target.checked } : item))} />
                  Hidden judge case
                </label>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => setTestCases((current) => [...current, { input: "", expectedOutput: "", isSample: false, isHidden: true }])}>
            <Plus className="mr-2 size-4" />
            Add test case
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
