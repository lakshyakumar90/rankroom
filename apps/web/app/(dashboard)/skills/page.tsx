"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PageContainer, PageHeader, EmptyState } from "@/components/common/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import type { ApiResponse } from "@repo/types";

interface Skill {
  id: string;
  name: string;
  category: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
}

const CATEGORIES = ["Languages", "Frameworks", "Databases", "Tools", "DSA Topics", "Other"];
const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};
const LEVEL_COLORS: Record<string, string> = {
  BEGINNER: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  INTERMEDIATE: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  ADVANCED: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  EXPERT: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Languages");
  const [level, setLevel] = useState<string>("BEGINNER");
  const [filterCategory, setFilterCategory] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<ApiResponse<Skill[]>>("/api/profile/skills"),
  });

  const skills = data?.data ?? [];
  const displayedSkills = filterCategory === "all"
    ? skills
    : skills.filter((s) => s.category === filterCategory);

  const grouped = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {});

  const addMutation = useMutation({
    mutationFn: () => api.post("/api/profile/skills", { name: name.trim(), category, level }),
    onSuccess: () => {
      toast.success("Skill added");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/profile/skills/${id}`),
    onSuccess: () => {
      toast.success("Skill removed");
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Profile"
        title="Skills"
        description="Manage your technical skill profile to improve event eligibility and recommendations."
      />

      {/* Add skill */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Add a skill</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="e.g. React, Python, SQL..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && addMutation.mutate()}
              className="w-52"
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!name.trim() || addMutation.isPending}
            >
              <Plus className="mr-2 size-4" />
              Add skill
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Category filter */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filterCategory === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All ({skills.length})
        </button>
        {Object.entries(grouped).map(([cat, items]) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat} ({items.length})
          </button>
        ))}
      </div>

      {/* Skills grid */}
      <div className="mt-4">
        {isLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
          </div>
        ) : displayedSkills.length === 0 ? (
          <EmptyState
            title="No skills yet"
            description="Add skills above to build your profile and qualify for more events."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {displayedSkills.map((skill) => (
              <div
                key={skill.id}
                className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${LEVEL_COLORS[skill.level]}`}
              >
                <span>{skill.name}</span>
                <span className="opacity-60">·</span>
                <span className="opacity-70">{LEVEL_LABELS[skill.level]}</span>
                <button
                  className="ml-1 opacity-0 group-hover:opacity-60 hover:opacity-100! transition-opacity"
                  onClick={() => deleteMutation.mutate(skill.id)}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {skills.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(grouped).map(([cat, items]) => (
            <Card key={cat}>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((s) => (
                    <Badge
                      key={s.id}
                      variant="outline"
                      className={`text-xs ${LEVEL_COLORS[s.level]}`}
                    >
                      {s.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
