"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getDifficultyColor, formatPoints } from "@/lib/utils";
import { Difficulty, type ApiResponse, type Problem } from "@repo/types";
import { Search, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

interface ProblemsResponse extends ApiResponse<(Problem & { isSolved: boolean; _count: { submissions: number } })[]> {}

export default function ProblemsPage() {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["problems", search, difficulty, tag, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (search) params.set("search", search);
      if (difficulty) params.set("difficulty", difficulty);
      if (tag) params.set("tag", tag);
      return api.get<ProblemsResponse>(`/api/problems?${params}`);
    },
  });

  const problems = data?.data ?? [];
  const pagination = data?.pagination;

  const difficultyBadgeVariant = (d: string): "easy" | "medium" | "hard" | "outline" => {
    if (d === "EASY") return "easy";
    if (d === "MEDIUM") return "medium";
    if (d === "HARD") return "hard";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Problems</h1>
          <p className="text-muted-foreground">Practice and improve your coding skills</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search problems..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-2">
          {["", "EASY", "MEDIUM", "HARD"].map((d) => (
            <Button
              key={d}
              variant={difficulty === d ? "default" : "outline"}
              size="sm"
              onClick={() => { setDifficulty(d); setPage(1); }}
            >
              {d || "All"}
            </Button>
          ))}
        </div>
      </div>

      {/* Problems table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-8">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Difficulty</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Tags</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Points</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
                </tr>
              ))
            ) : (
              problems.map((problem, idx) => (
                <tr key={problem.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {problem.isSolved ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/problems/${problem.slug}`} className="font-medium hover:text-primary transition-colors">
                      {problem.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant={difficultyBadgeVariant(problem.difficulty)} className="capitalize">
                      {problem.difficulty.charAt(0) + problem.difficulty.slice(1).toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {problem.tags.slice(0, 3).map((t) => (
                        <button key={t} onClick={() => setTag(tag === t ? "" : t)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                          {t}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    {formatPoints(problem.points)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
