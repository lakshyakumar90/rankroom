"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type ApiResponse, type Problem } from "@repo/types";
import { createContestSchema } from "@repo/validators";
import { toast } from "sonner";
import { ArrowLeft, X, Search } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

type CreateContestInput = z.infer<typeof createContestSchema>;
type ClassOption = { id: string; name: string; code: string; department?: { name: string; code: string } };
type StudentOption = {
  student: {
    id: string;
    name: string;
    email: string;
  };
};

export default function CreateContestPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [type, setType] = useState<"PUBLIC" | "PRIVATE" | "INSTITUTIONAL">("PUBLIC");
  const [rules, setRules] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [selectedProblems, setSelectedProblems] = useState<Problem[]>([]);
  const [problemSearch, setProblemSearch] = useState("");

  const { data: problemsData } = useQuery({
    queryKey: ["problems-list", problemSearch],
    queryFn: () =>
      api.get<ApiResponse<Problem[]>>(
        `/api/problems?page=1&limit=20${problemSearch ? `&search=${encodeURIComponent(problemSearch)}` : ""}`
      ),
    enabled: true,
  });

  const { data: classesData } = useQuery({
    queryKey: ["contest-create", "classes"],
    queryFn: () => api.get<ApiResponse<ClassOption[]>>("/api/users/me/classes"),
    enabled: !!user,
  });

  const { data: studentsData } = useQuery({
    queryKey: ["contest-create", "students", sectionId],
    queryFn: () => api.get<ApiResponse<StudentOption[]>>(`/api/users/section/${sectionId}/students`),
    enabled: !!sectionId,
  });

  const sectionOptions = classesData?.data ?? [];
  const studentOptions = studentsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (body: CreateContestInput) =>
      api.post<ApiResponse<{ id: string }>>("/api/contests", body),
    onSuccess: (res) => {
      toast.success("Contest created!");
      router.push(`/contests/${res.data?.id}`);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create contest"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedProblems.length === 0) {
      toast.error("Select at least one problem");
      return;
    }

    const parsed = createContestSchema.safeParse({
      title,
      description,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      type,
      rules: rules || undefined,
      problemIds: selectedProblems.map((p) => p.id),
      sectionId: sectionId || undefined,
      participantIds,
    });

    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Validation error");
      return;
    }

    createMutation.mutate(parsed.data);
  }

  const toggleProblem = (problem: Problem) => {
    setSelectedProblems((prev) =>
      prev.find((p) => p.id === problem.id)
        ? prev.filter((p) => p.id !== problem.id)
        : [...prev, problem]
    );
  };

  const problems = problemsData?.data ?? [];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/contests" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Contest</h1>
          <p className="text-muted-foreground text-sm">Set up a new coding contest</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly Contest #1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                placeholder="Describe the contest goals, scoring method, etc."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(["PUBLIC", "PRIVATE", "INSTITUTIONAL"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setType(t)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      type === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {sectionOptions.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="sectionId">Section scope</Label>
                <select
                  id="sectionId"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="h-9 w-full border border-input bg-background px-3 text-sm"
                >
                  <option value="">Department / open scope</option>
                  {sectionOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {sectionId ? (
              <div className="space-y-2">
                <Label>Selected students (optional)</Label>
                <div className="max-h-44 space-y-2 overflow-y-auto border border-border p-3">
                  {studentOptions.map((entry) => (
                    <label key={entry.student.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={participantIds.includes(entry.student.id)}
                        onChange={() =>
                          setParticipantIds((current) =>
                            current.includes(entry.student.id)
                              ? current.filter((id) => id !== entry.student.id)
                              : [...current, entry.student.id]
                          )
                        }
                      />
                      <span>{entry.student.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="rules">Rules (optional)</Label>
              <textarea
                id="rules"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={3}
                placeholder="Any special rules or constraints for this contest..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Problem selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Problems{" "}
              <span className="text-muted-foreground font-normal">
                ({selectedProblems.length} selected)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected chips */}
            {selectedProblems.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedProblems.map((p) => (
                  <Badge key={p.id} variant="secondary" className="gap-1">
                    {p.title}
                    <button
                      type="button"
                      onClick={() => toggleProblem(p)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={problemSearch}
                onChange={(e) => setProblemSearch(e.target.value)}
                placeholder="Search problems..."
                className="pl-9"
              />
            </div>

            {/* Problem list */}
            <div className="max-h-60 overflow-y-auto space-y-2 rounded-md border border-border p-2">
              {problems.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No problems found
                </p>
              ) : (
                problems.map((problem) => {
                  const isSelected = selectedProblems.some((p) => p.id === problem.id);
                  const diffBadge =
                    problem.difficulty === "EASY"
                      ? "easy"
                      : problem.difficulty === "MEDIUM"
                      ? "medium"
                      : "hard";

                  return (
                    <button
                      type="button"
                      key={problem.id}
                      onClick={() => toggleProblem(problem)}
                      className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <span className="font-medium truncate mr-2">
                        {problem.title}
                      </span>
                      <Badge variant={diffBadge} className="shrink-0 text-xs capitalize">
                        {problem.difficulty.charAt(0) +
                          problem.difficulty.slice(1).toLowerCase()}
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Creating…" : "Create Contest"}
          </Button>
          <Link href="/contests">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
