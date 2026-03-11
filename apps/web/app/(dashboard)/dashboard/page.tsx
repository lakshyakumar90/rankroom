"use client";

import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Role, type ApiResponse } from "@repo/types";
import { Trophy, Code2, ClipboardList, BookOpen, TrendingUp, Award } from "lucide-react";
import Link from "next/link";
import { formatPoints } from "@/lib/utils";

interface StatsData {
  leaderboard: { totalPoints: number; rank?: number | null; problemsSolved: number; easySolved: number; mediumSolved: number; hardSolved: number; contestsParticipated: number } | null;
  submissionsByStatus: { status: string; _count: number }[];
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: statsData, isLoading } = useQuery({
    queryKey: ["analytics", "me"],
    queryFn: () => api.get<ApiResponse<StatsData>>("/api/analytics/me"),
    enabled: !!user,
  });

  const stats = statsData?.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-muted-foreground">
          {user?.role === Role.STUDENT && "Track your progress, solve problems, and compete."}
          {user?.role === Role.TEACHER && "Manage your classes, assignments, and grades."}
          {user?.role === Role.ADMIN && "Oversee the entire platform from here."}
        </p>
      </div>

      {/* Stats grid */}
      {user?.role === Role.STUDENT && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Points"
            value={isLoading ? null : formatPoints(stats?.leaderboard?.totalPoints ?? 0)}
            icon={<Trophy className="h-4 w-4 text-amber-500" />}
            description={stats?.leaderboard?.rank ? `Rank #${stats.leaderboard.rank}` : "Unranked"}
          />
          <StatCard
            title="Problems Solved"
            value={isLoading ? null : stats?.leaderboard?.problemsSolved?.toString() ?? "0"}
            icon={<Code2 className="h-4 w-4 text-violet-500" />}
            description={isLoading ? "" : `${stats?.leaderboard?.easySolved ?? 0}E / ${stats?.leaderboard?.mediumSolved ?? 0}M / ${stats?.leaderboard?.hardSolved ?? 0}H`}
          />
          <StatCard
            title="Contests"
            value={isLoading ? null : stats?.leaderboard?.contestsParticipated?.toString() ?? "0"}
            icon={<Award className="h-4 w-4 text-blue-500" />}
            description="Participated"
          />
          <StatCard
            title="Submissions"
            value={isLoading ? null : stats?.submissionsByStatus?.reduce((a, s) => a + s._count, 0)?.toString() ?? "0"}
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            description={`${stats?.submissionsByStatus?.find((s) => s.status === "ACCEPTED")?._count ?? 0} accepted`}
          />
        </div>
      )}

      {/* Quick access cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickCard
          href="/problems"
          title="Practice Problems"
          description="Solve algorithmic challenges across all difficulty levels"
          icon={<Code2 className="h-6 w-6 text-violet-500" />}
          badge="Code"
        />
        <QuickCard
          href="/contests"
          title="Contests"
          description="Compete in timed contests and climb the leaderboard"
          icon={<Trophy className="h-6 w-6 text-amber-500" />}
          badge="Compete"
        />
        <QuickCard
          href="/leaderboard"
          title="Leaderboard"
          description="See how you rank among peers globally and in your class"
          icon={<Award className="h-6 w-6 text-blue-500" />}
          badge="Rankings"
        />
        {user?.role !== Role.ADMIN && (
          <>
            <QuickCard
              href="/attendance"
              title="Attendance"
              description={user?.role === Role.TEACHER ? "Mark and view class attendance" : "Check your attendance records"}
              icon={<ClipboardList className="h-6 w-6 text-emerald-500" />}
              badge="Academic"
            />
            <QuickCard
              href="/assignments"
              title="Assignments"
              description={user?.role === Role.TEACHER ? "Create and grade assignments" : "View and submit assignments"}
              icon={<BookOpen className="h-6 w-6 text-orange-500" />}
              badge="Academic"
            />
            <QuickCard
              href="/analytics"
              title="Analytics"
              description="View detailed performance analytics and trends"
              icon={<TrendingUp className="h-6 w-6 text-pink-500" />}
              badge="Insights"
            />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, description }: { title: string; value: string | null; icon: React.ReactNode; description: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function QuickCard({ href, title, description, icon, badge }: { href: string; title: string; description: string; icon: React.ReactNode; badge: string }) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-all duration-150 hover:border-primary/30 hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            {icon}
            <Badge variant="outline" className="text-xs">{badge}</Badge>
          </div>
          <h3 className="mt-3 font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
