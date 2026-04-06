"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import type { ApiResponse } from "@repo/types";
import {
  GraduationCap,
  ClipboardList,
  Code2,
  Trophy,
  TrendingUp,
  AlertCircle,
  Brain,
} from "lucide-react";

interface StudentProfileData {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  studentProfile?: {
    cgpa?: number | null;
    leetcodeSolved?: number | null;
    codingXP?: number | null;
    githubContributions?: number | null;
    skills?: Array<{ name: string; level: string }>;
  } | null;
  leaderboard?: {
    totalScore?: number | null;
    rank?: number | null;
    codingXP?: number | null;
  } | null;
}

interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

interface SubjectGrade {
  subjectName: string;
  subjectCode: string;
  percentage: number;
  obtained: number;
  maxMarks: number;
}

interface StudentAnalytics {
  profile: StudentProfileData;
  skillGraph?: {
    skills: Array<{ key: string; label: string; score: number; trend: number }>;
    summary: {
      activityScore: number;
      consistencyScore: number;
      strongestSkills: Array<{ key: string; label: string; score: number; trend: number }>;
      weakestSkills: Array<{ key: string; label: string; score: number; trend: number }>;
    };
    coachAdvice: {
      warning: string;
      motivation: string;
      tasks: string[];
      source: string;
      createdAt: string;
    } | null;
  };
  attendance?: AttendanceSummary;
  grades?: SubjectGrade[];
  recentSubmissions?: Array<{
    id: string;
    problemTitle: string;
    status: string;
    language: string;
    createdAt: string;
  }>;
}

function StatCard({
  icon,
  label,
  value,
  color = "text-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-lg font-bold ${color}`}>{value ?? "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentPerformancePanel({
  studentId,
  sectionId,
  open,
  onClose,
}: {
  studentId: string | null;
  sectionId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-analytics", studentId, sectionId],
    queryFn: () =>
      api.get<ApiResponse<StudentAnalytics>>(
        `/api/analytics/student/${studentId}${sectionId ? `?sectionId=${sectionId}` : ""}`
      ),
    enabled: !!studentId && open,
  });

  const analytics = data?.data;
  const profile = analytics?.profile;
  const attendance = analytics?.attendance;
  const grades = analytics?.grades ?? [];
  const submissions = analytics?.recentSubmissions ?? [];
  const skillGraph = analytics?.skillGraph;

  const cgpa = profile?.studentProfile?.cgpa;
  const rank = profile?.leaderboard?.rank;
  const codingXP = profile?.leaderboard?.codingXP ?? profile?.studentProfile?.codingXP;
  const leetcode = profile?.studentProfile?.leetcodeSolved;

  const cgpaColor = !cgpa ? "text-muted-foreground" : cgpa >= 8 ? "text-emerald-500" : cgpa >= 6 ? "text-amber-500" : "text-red-500";
  const attendancePct = attendance?.percentage;
  const attendanceColor = !attendancePct ? "text-muted-foreground" : attendancePct >= 75 ? "text-emerald-500" : attendancePct >= 60 ? "text-amber-500" : "text-red-500";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {profile ? (
              <>
                <Avatar src={profile.avatar} name={profile.name} size="md" />
                <div>
                  <p>{profile.name}</p>
                  <p className="text-sm font-normal text-muted-foreground">{profile.email}</p>
                </div>
              </>
            ) : (
              <Skeleton className="h-8 w-48" />
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !analytics ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <AlertCircle className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Performance data not available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard
                icon={<GraduationCap className="size-5 text-primary" />}
                label="CGPA"
                value={cgpa != null ? cgpa.toFixed(2) : undefined}
                color={cgpaColor}
              />
              <StatCard
                icon={<ClipboardList className="size-5 text-primary" />}
                label="Attendance"
                value={attendancePct != null ? `${attendancePct.toFixed(1)}%` : undefined}
                color={attendanceColor}
              />
              <StatCard
                icon={<Code2 className="size-5 text-primary" />}
                label="LeetCode Solved"
                value={leetcode}
              />
              <StatCard
                icon={<Trophy className="size-5 text-primary" />}
                label="Rank / XP"
                value={rank != null ? `#${rank} · ${codingXP ?? 0} XP` : (codingXP ? `${codingXP} XP` : undefined)}
              />
            </div>

            {/* Attendance breakdown */}
            {attendance && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Attendance Breakdown</p>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-bold text-emerald-500">{attendance.present}</p>
                    <p className="text-xs text-muted-foreground">Present</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-red-500">{attendance.absent}</p>
                    <p className="text-xs text-muted-foreground">Absent</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-amber-500">{attendance.late}</p>
                    <p className="text-xs text-muted-foreground">Late</p>
                  </div>
                </div>
              </div>
            )}

            {/* Subject grades */}
            {grades.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="size-3.5" />
                  Subject Performance
                </p>
                <div className="space-y-2">
                  {grades.map((g) => (
                    <div key={g.subjectCode} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{g.subjectName}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {g.obtained}/{g.maxMarks} ({g.percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${g.percentage >= 60 ? "bg-emerald-500" : g.percentage >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, g.percentage)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent submissions */}
            {submissions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Code2 className="size-3.5" />
                  Recent Submissions
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {submissions.slice(0, 8).map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-xs">
                      <span className="truncate font-medium">{sub.problemTitle}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{sub.language}</Badge>
                        <span className={`font-medium ${sub.status === "ACCEPTED" ? "text-emerald-500" : "text-red-500"}`}>
                          {sub.status === "ACCEPTED" ? "AC" : sub.status.replace("_", " ").slice(0, 6)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {profile?.studentProfile?.skills && profile.studentProfile.skills.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.studentProfile.skills.slice(0, 12).map((skill) => (
                    <Badge key={skill.name} variant="secondary" className="text-xs">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {skillGraph && skillGraph.skills.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Brain className="size-3.5" />
                  Skill intelligence
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard
                    icon={<TrendingUp className="size-5 text-primary" />}
                    label="Activity score"
                    value={skillGraph.summary.activityScore.toFixed(1)}
                  />
                  <StatCard
                    icon={<Trophy className="size-5 text-primary" />}
                    label="Consistency score"
                    value={skillGraph.summary.consistencyScore.toFixed(1)}
                  />
                </div>
                <div className="space-y-2">
                  {skillGraph.summary.strongestSkills.slice(0, 4).map((skill) => (
                    <div key={skill.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{skill.label}</span>
                        <span className="text-muted-foreground">{skill.score.toFixed(1)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, skill.score)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {skillGraph.coachAdvice ? (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium">{skillGraph.coachAdvice.warning}</p>
                    <p className="mt-2 text-muted-foreground">{skillGraph.coachAdvice.motivation}</p>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {skillGraph.coachAdvice.tasks.map((task) => (
                        <p key={task}>• {task}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
