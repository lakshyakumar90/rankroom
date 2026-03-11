"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { type ApiResponse, type Problem } from "@repo/types";
import { getDifficultyColor } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

interface ContestProblem {
  id: string;
  contestId: string;
  problemId: string;
  order: number;
  points: number;
  problem: Pick<Problem, "id" | "title" | "slug" | "difficulty" | "tags" | "points">;
}

export default function ContestProblemsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ["contest-problems", id],
    queryFn: () => api.get<ApiResponse<ContestProblem[]>>(`/api/contests/${id}/problems`),
  });

  const problems = data?.data ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/contests/${id}`} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contest Problems</h1>
          <p className="text-muted-foreground text-sm">{problems.length} problems</p>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16" />
              </CardContent>
            </Card>
          ))
        ) : problems.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No problems added to this contest yet.
          </div>
        ) : (
          problems.map((cp) => {
            const diffBadge =
              cp.problem.difficulty === "EASY"
                ? "easy"
                : cp.problem.difficulty === "MEDIUM"
                ? "medium"
                : "hard";

            return (
              <Link
                key={cp.id}
                href={`/problems/${cp.problem.slug}?contestId=${id}`}
              >
                <Card className="cursor-pointer hover:border-primary/30 transition-colors">
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* Order label */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted font-semibold text-sm">
                      {cp.order}
                    </div>

                    {/* Problem info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium truncate">{cp.problem.title}</p>
                        <Badge variant={diffBadge} className="capitalize text-xs">
                          {cp.problem.difficulty.charAt(0) +
                            cp.problem.difficulty.slice(1).toLowerCase()}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {cp.problem.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-amber-500">{cp.points} pts</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
