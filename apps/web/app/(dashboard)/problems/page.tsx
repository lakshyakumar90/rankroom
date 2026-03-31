"use client";

import Link from "next/link";
import { startTransition, Suspense, useDeferredValue, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileQuestion, Lock, MinusCircle, Search } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ApiResponse } from "@repo/types";

interface ProblemRow {
  id: string;
  number: number;
  title: string;
  slug: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  acceptanceRate: number;
  userStatus: "solved" | "attempted" | "unsolved";
  companies?: string[];
}

interface ProblemsResponse extends ApiResponse<ProblemRow[]> {}

function ProblemSkeletonRows() {
  return Array.from({ length: 20 }).map((_, index) => (
    <TableRow key={index} className="h-14">
      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
      <TableCell><Skeleton className="h-5 w-64" /></TableCell>
      <TableCell><div className="flex gap-2"><Skeleton className="h-5 w-12 rounded-full" /><Skeleton className="h-5 w-16 rounded-full" /></div></TableCell>
      <TableCell><Skeleton className="h-6 w-16 rounded-md" /></TableCell>
      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-12" /></TableCell>
      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-4" /></TableCell>
    </TableRow>
  ));
}

function ProblemsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = searchParams.get("page") ?? "1";
  const search = searchParams.get("search") ?? "";
  const deferredSearch = useDeferredValue(search);
  const difficulty = searchParams.get("difficulty") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const selectedTopics = searchParams.getAll("tag");

  const setParam = (updates: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((item) => next.append(key, item));
      else if (value) next.set(key, value);
    }

    if (!updates.page) next.set("page", "1");
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["problems", { page, deferredSearch, difficulty, status, selectedTopics }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: "20" });
      if (deferredSearch) params.set("search", deferredSearch);
      if (difficulty !== "all") params.set("difficulty", difficulty);
      if (status !== "all") params.set("status", status);
      selectedTopics.forEach((topic) => params.append("tag", topic));
      return api.get<ProblemsResponse>(`/api/problems?${params.toString()}`);
    },
  });

  const { data: tagPoolData } = useQuery({
    queryKey: ["problem-tags"],
    queryFn: () => api.get<ProblemsResponse>("/api/problems?page=1&limit=100"),
  });

  const problems = data?.data ?? [];
  const pagination = data?.pagination;
  const topics = useMemo(
    () => Array.from(new Set((tagPoolData?.data ?? []).flatMap((problem) => problem.tags))).sort((a, b) => a.localeCompare(b)),
    [tagPoolData?.data]
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Problems</h1>
            <Badge variant="outline" className="text-sm text-muted-foreground">{pagination?.total ?? 0}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setParam({ search: event.target.value || null })} placeholder="Search problems..." className="pl-9" />
            </div>

            <Select value={difficulty} onValueChange={(value) => setParam({ difficulty: value === "all" ? null : value })}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(value) => setParam({ status: value === "all" ? null : value })}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="solved">Solved</SelectItem>
                <SelectItem value="attempted">Attempted</SelectItem>
                <SelectItem value="unsolved">Unsolved</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  Topics
                  <span className="text-muted-foreground">▾</span>
                  {selectedTopics.length > 0 && <Badge variant="secondary">{selectedTopics.length}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                {topics.map((topic) => (
                  <DropdownMenuCheckboxItem
                    key={topic}
                    checked={selectedTopics.includes(topic)}
                    onCheckedChange={(checked) =>
                      setParam({
                        tag: checked
                          ? Array.from(new Set([...selectedTopics, topic]))
                          : selectedTopics.filter((selectedTopic) => selectedTopic !== topic),
                      })
                    }
                  >
                    {topic}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10" />
                <TableHead className="w-16">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead className="text-right">Acceptance</TableHead>
                <TableHead className="text-right">Solution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <ProblemSkeletonRows />
              ) : problems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <FileQuestion className="h-16 w-16 text-muted-foreground" />
                      <div>
                        <p className="text-lg font-medium">No problems found</p>
                        <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
                      </div>
                      <Button variant="outline" onClick={() => router.push(pathname)}>Reset Filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((problem) => (
                  <TableRow
                    key={problem.id}
                    className={cn(
                      "h-14 cursor-pointer bg-transparent transition-colors hover:bg-muted/50",
                      problem.userStatus === "solved" && "bg-green-400/5"
                    )}
                    onClick={() => router.push(`/problems/${problem.id}`)}
                  >
                    <TableCell>
                      {problem.userStatus === "solved" ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : problem.userStatus === "attempted" ? <MinusCircle className="h-4 w-4 text-yellow-400" /> : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{problem.number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link href={`/problems/${problem.id}`} onClick={(event) => event.stopPropagation()} className="font-medium transition-colors hover:text-primary">
                          {problem.title}
                        </Link>
                        {!!problem.companies?.length && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex gap-1">
                                {problem.companies.slice(0, 2).map((company) => <Badge key={company} variant="outline" className="text-xs">{company}</Badge>)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{problem.companies.join(", ")}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {problem.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="secondary" className="rounded-full px-2 py-0.5 text-xs">{tag}</Badge>)}
                        {problem.tags.length > 3 && <Badge variant="outline" className="rounded-full text-xs">+{problem.tags.length - 3} more</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("rounded-md border-0", problem.difficulty === "EASY" && "bg-green-400/10 text-green-400", problem.difficulty === "MEDIUM" && "bg-yellow-400/10 text-yellow-400", problem.difficulty === "HARD" && "bg-red-400/10 text-red-400")}>
                        {problem.difficulty}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{problem.acceptanceRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right"><Lock className="ml-auto h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {pagination && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} problems
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setParam({ page: String(pagination.page - 1) })}>Prev</Button>
              {Array.from({ length: pagination.totalPages }).slice(0, 5).map((_, index) => {
                const pageNumber = index + 1;
                return (
                  <Button key={pageNumber} variant={pageNumber === pagination.page ? "default" : "outline"} size="sm" onClick={() => setParam({ page: String(pageNumber) })}>
                    {pageNumber}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setParam({ page: String(pagination.page + 1) })}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default function ProblemsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading problems...</div>}>
      <ProblemsPageContent />
    </Suspense>
  );
}
