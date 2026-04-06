"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ActivityHeatmap } from "@repo/ui/charts/ActivityHeatmap";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import type { ApiResponse, Role } from "@repo/types";
import {
  Award,
  BookOpen,
  Code2,
  ExternalLink,
  Github,
  Link as LinkIcon,
  Trophy,
  Users,
  LayoutDashboard,
  Briefcase,
  GraduationCap,
  RefreshCcw,
  Globe,
  Mail,
  MapPin,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface PublicProfileData {
  id: string;
  name: string;
  email?: string;
  role: Role;
  avatar?: string | null;
  githubUsername?: string | null;
  createdAt: string;
  profile?: {
    handle?: string | null;
    isPublic: boolean;
  } | null;
  studentProfile: {
    bio?: string | null;
    githubUsername?: string | null;
    leetcodeUsername?: string | null;
    codechefUsername?: string | null;
    codeforcesUsername?: string | null;
    leetcodeSolved: number;
    leetcodeEasy: number;
    leetcodeMedium: number;
    leetcodeHard: number;
    leetcodeAcceptanceRate?: number | null;
    githubContributions: number;
    githubTopLanguages?: Array<{ name: string; count: number }> | null;
    codechefRating?: number | null;
    codechefMaxRating?: number | null;
    codechefStars?: number | null;
    codeforcesRating?: number | null;
    codeforcesMaxRating?: number | null;
    codeforcesRank?: string | null;
    cgpa?: number | null;
    activityHeatmap: Record<string, number>;
    resumeUrl?: string | null;
    resumeFilename?: string | null;
    skills: Array<{ id: string; name: string; category: string; level: string }>;
    projects: Array<{
      id: string;
      title: string;
      description: string;
      techStack: string[];
      githubUrl?: string | null;
      liveUrl?: string | null;
      imageUrl?: string | null;
      featured?: boolean;
    }>;
    achievements: Array<{
      id: string;
      title: string;
      description?: string | null;
      date: string;
      category: string;
      certificateUrl?: string | null;
    }>;
  };
  leaderboard?: {
    totalPoints: number;
    problemsSolved: number;
    contestsParticipated: number;
  } | null;
  enrollments?: Array<{
    section: {
      id: string;
      name: string;
      code: string;
      semester: number;
      academicYear: string;
      department: { id: string; name: string; code: string };
    };
  }>;
  certificates?: Array<{
    id: string;
    title: string;
    type: string;
    issuedAt: string;
    externalUrl?: string | null;
    verificationCode?: string | null;
  }>;
}

function StatChip({
  label,
  value,
  icon: Icon,
  className = "",
}: {
  label: string;
  value: string | number;
  icon: any;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md ${className}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
    </div>
  );
}

function platformLink(label: string, href: string, icon: React.ReactNode) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition-all hover:bg-muted hover:text-primary"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

export function PublicProfileView({ username }: { username: string }) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState("overview");
  const [hasAutoSyncAttempted, setHasAutoSyncAttempted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () =>
      api.get<ApiResponse<PublicProfileData>>(
        `/api/users/public/${encodeURIComponent(decodeURIComponent(username))}`
      ),
  });

  const profile = data?.data ?? null;
  const isOwner = currentUser?.id === profile?.id;

  const syncMutation = useMutation({
    mutationFn: (platform: string) => api.post("/api/profile/sync", { platform }),
    onSuccess: () => {
      toast.success("Sync triggered successfully!");
      void queryClient.invalidateQueries({ queryKey: ["public-profile", username] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // If profile activityHeatmap is empty, fetch it from the heatmap endpoint (builds from submissions)
  const embeddedHeatmapTotal = useMemo(
    () =>
      Object.values(profile?.studentProfile?.activityHeatmap ?? {}).reduce(
        (sum, value) => sum + Math.max(0, value ?? 0),
        0
      ),
    [profile?.studentProfile?.activityHeatmap]
  );
  const hasHeatmapData = embeddedHeatmapTotal > 0;
  const { data: heatmapData } = useQuery({
    queryKey: ["profile-heatmap", profile?.id],
    queryFn: () =>
      api.get<ApiResponse<Record<string, number>>>(
        `/api/profile/${encodeURIComponent(profile!.id)}/heatmap`
      ),
    enabled:
      !!profile?.id &&
      !hasHeatmapData &&
      (activeTab === "overview" || !activeTab),
  });

  const effectiveHeatmap = useMemo(() => {
    return hasHeatmapData
      ? (profile?.studentProfile?.activityHeatmap ?? {})
      : (heatmapData?.data ?? {});
  }, [profile, heatmapData, hasHeatmapData]);

  useEffect(() => {
    if (!profile || !isOwner || hasAutoSyncAttempted || syncMutation.isPending) {
      return;
    }

    const shouldBackfillHeatmap =
      !hasHeatmapData &&
      (profile.studentProfile.githubContributions > 0 ||
        profile.studentProfile.leetcodeSolved > 0 ||
        (profile.leaderboard?.problemsSolved ?? 0) > 0);

    if (!shouldBackfillHeatmap) return;

    setHasAutoSyncAttempted(true);
    syncMutation.mutate("all");
  }, [
    profile,
    isOwner,
    hasAutoSyncAttempted,
    hasHeatmapData,
    syncMutation.isPending,
  ]);

  const availableYears = useMemo(() => {
    const keys = Object.keys(effectiveHeatmap);
    if (keys.length === 0) return [new Date().getFullYear()];
    const years = keys.map((date) => Number.parseInt(date.slice(0, 4), 10));
    return [...new Set(years)].sort((left, right) => right - left);
  }, [effectiveHeatmap]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]!);
    }
  }, [availableYears]);

  const leetcodeData = useMemo(() => {
    if (!profile) return [];
    return [
      { name: "Easy", value: profile.studentProfile.leetcodeEasy, color: "#10b981" },
      { name: "Medium", value: profile.studentProfile.leetcodeMedium, color: "#f59e0b" },
      { name: "Hard", value: profile.studentProfile.leetcodeHard, color: "#ef4444" },
    ];
  }, [profile]);

  const skillsByCategory = useMemo(() => {
    const grouped = new Map<string, Array<{ id: string; name: string; level: string }>>();
    for (const skill of profile?.studentProfile.skills ?? []) {
      const current = grouped.get(skill.category) ?? [];
      current.push({ id: skill.id, name: skill.name, level: skill.level });
      grouped.set(skill.category, current);
    }
    return Array.from(grouped.entries());
  }, [profile?.studentProfile.skills]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        <div className="flex gap-8">
          <Skeleton className="size-32 rounded-3xl" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-2/3 rounded-xl" />
            <Skeleton className="h-6 w-1/3 rounded-lg" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-100 w-full rounded-3xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6 py-16 text-center">
        <div className="space-y-4">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
            <Users className="size-8 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile not found</h1>
            <p className="mt-2 text-muted-foreground">
              This profile doesn&apos;t exist or is currently set to private.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-4">
            <a href="/">Go Home</a>
          </Button>
        </div>
      </div>
    );
  }

  const primaryEnrollment = profile.enrollments?.[0]?.section;
  const rankRoomSolved = profile.leaderboard?.problemsSolved ?? 0;
  const leetcodeSolved = profile.studentProfile.leetcodeSolved ?? 0;
  const totalSolved = rankRoomSolved + leetcodeSolved;
  const leetcodeDistribution =
    leetcodeSolved > 0
      ? {
          easy: (profile.studentProfile.leetcodeEasy / leetcodeSolved) * 100,
          medium: (profile.studentProfile.leetcodeMedium / leetcodeSolved) * 100,
          hard: (profile.studentProfile.leetcodeHard / leetcodeSolved) * 100,
        }
      : { easy: 0, medium: 0, hard: 0 };

  return (
    <div className="min-h-screen bg-background/50">
      {/* Premium Header */}
      <div className="relative overflow-hidden border-b border-border bg-card pb-0 pt-12">
        <div className="absolute inset-0 z-0 bg-linear-to-br from-primary/5 via-background to-transparent opacity-50" />
        <div className="container relative z-10 mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="relative">
                <Avatar
                  src={profile.avatar}
                  name={profile.name}
                  size="lg"
                  className="size-32 border-4 border-background text-4xl shadow-2xl"
                />
                <div className="absolute -bottom-2 -right-2 rounded-full border-2 border-background bg-primary p-1.5 text-primary-foreground">
                  <Award className="size-5" />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
                    {profile.name}
                  </h1>
                  <Badge variant="secondary" className="px-3 py-1 font-semibold uppercase tracking-wider text-[10px]">
                    {profile.role.replaceAll("_", " ")}
                  </Badge>
                  {isOwner && (
                    <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-full border" asChild>
                      <a href="/settings">Edit Profile</a>
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-muted-foreground">
                  {profile.studentProfile.githubUsername && (
                    <div className="flex items-center gap-1.5">
                      <Github className="size-4" />
                      <span>@{profile.studentProfile.githubUsername}</span>
                    </div>
                  )}
                  {primaryEnrollment && (
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="size-4" />
                      <span>{primaryEnrollment.department.name} • {primaryEnrollment.code}</span>
                    </div>
                  )}
                  {profile.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="size-4" />
                      <span>{profile.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-4" />
                    <span>Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>

                {profile.studentProfile.bio && (
                  <p className="max-w-2xl text-base leading-relaxed text-muted-foreground/90">
                    {profile.studentProfile.bio}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.studentProfile.githubUsername &&
                    platformLink("GitHub", `https://github.com/${profile.studentProfile.githubUsername}`, <Github className="size-4" />)}
                  {profile.studentProfile.leetcodeUsername &&
                    platformLink("LeetCode", `https://leetcode.com/${profile.studentProfile.leetcodeUsername}`, <Code2 className="size-4" />)}
                  {profile.studentProfile.codechefUsername &&
                    platformLink("CodeChef", `https://www.codechef.com/users/${profile.studentProfile.codechefUsername}`, <Trophy className="size-4" />)}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex gap-2">
                {isOwner && (
                  <Button
                    variant="outline"
                    className="gap-2 rounded-xl"
                    onClick={() => syncMutation.mutate("all")}
                    disabled={syncMutation.isPending}
                  >
                    <RefreshCcw className={`size-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                    Sync Data
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-[10px]">Points</p>
                  <p className="text-2xl font-bold text-primary">{profile.leaderboard?.totalPoints ?? 0}</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-[10px]">Solutions</p>
                  <p className="text-2xl font-bold">{totalSolved}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-0 h-14 w-full justify-start gap-8 bg-transparent p-0">
                <TabsTrigger
                  value="overview"
                  className="h-full rounded-none border-b-2 border-transparent px-0 text-base font-medium data-active:border-primary data-active:bg-transparent data-active:text-primary data-active:shadow-none"
                >
                  <LayoutDashboard className="mr-2 size-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="projects"
                  className="h-full rounded-none border-b-2 border-transparent px-0 text-base font-medium data-active:border-primary data-active:bg-transparent data-active:text-primary data-active:shadow-none"
                >
                  <Briefcase className="mr-2 size-4" />
                  Projects
                  {profile.studentProfile.projects.length > 0 && (
                    <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px]">{profile.studentProfile.projects.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="achievements"
                  className="h-full rounded-none border-b-2 border-transparent px-0 text-base font-medium data-active:border-primary data-active:bg-transparent data-active:text-primary data-active:shadow-none"
                >
                  <Award className="mr-2 size-4" />
                  Achievements
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="h-full rounded-none border-b-2 border-transparent px-0 text-base font-medium data-active:border-primary data-active:bg-transparent data-active:text-primary data-active:shadow-none"
                >
                  <Code2 className="mr-2 size-4" />
                  Coding Stats
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-6 py-10">
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="overview" className="space-y-8 mt-0">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <StatChip label="Total Solved" value={totalSolved} icon={Code2} />
              <StatChip label="RankRoom Solved" value={rankRoomSolved} icon={BookOpen} />
              <StatChip label="LeetCode Solved" value={leetcodeSolved} icon={Code2} />
              <StatChip label="GitHub Contribs" value={profile.studentProfile.githubContributions} icon={Github} />
              <StatChip label="Experience" value={`${profile.studentProfile.projects.length} Projects`} icon={Briefcase} />
              <StatChip label="Academics" value={profile.studentProfile.cgpa ? `${profile.studentProfile.cgpa} CGPA` : "N/A"} icon={GraduationCap} />
            </div>

            {/* Combined Heatmap Card */}
            <Card className="overflow-hidden border-2 border-primary/10 shadow-lg">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b bg-muted/30">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    Combined Activity Heatmap
                    <Badge variant="outline" className="bg-primary/5 text-primary text-[10px] uppercase font-bold">Unified</Badge>
                  </CardTitle>
                  <CardDescription>
                    Tracking your contributions across GitHub, LeetCode, and RankRoom submissions.
                  </CardDescription>
                </div>
                <div className="w-full sm:w-40">
                  <Select
                    value={String(selectedYear)}
                    onValueChange={(value) => setSelectedYear(Number.parseInt(value, 10))}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ActivityHeatmap
                  year={selectedYear}
                  data={effectiveHeatmap}
                  className="w-full"
                />
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
              {/* LeetCode Difficulty Distribution */}
              <Card className="col-span-1 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Problem Difficulty</CardTitle>
                  <CardDescription>Distribution of solved problems</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-50 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leetcodeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {leetcodeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {leetcodeData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Skills and Languages */}
              <Card className="col-span-2 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Top Skills & Languages</CardTitle>
                  <CardDescription>Expertise across technologies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {skillsByCategory.length > 0 ? (
                    <div className="flex flex-wrap gap-4">
                      {skillsByCategory.map(([category, skills]) => (
                        <div key={category} className="space-y-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{category}</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {skills.map((skill) => (
                              <Badge key={skill.id} variant="secondary" className="rounded-lg px-2.5 py-1 text-xs">
                                {skill.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">Add skills in your profile settings.</p>
                  )}

                  {profile.studentProfile.githubTopLanguages && profile.studentProfile.githubTopLanguages.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-border/50">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top GitHub Languages</h4>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {profile.studentProfile.githubTopLanguages.map((lang) => (
                          <div key={lang.name} className="flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1">
                            <span className="font-medium">{lang.name}</span>
                            <span className="text-muted-foreground opacity-60">({lang.count}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="mt-0">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {profile.studentProfile.projects.map((project) => (
                <Card key={project.id} className="group relative overflow-hidden transition-all hover:border-primary/50 hover:shadow-xl">
                  <div
                    className="h-40 w-full overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.488 0.243 264.376 / 0.1), oklch(0.8 0.1 120 / 0.1))",
                    }}
                  >
                    {project.imageUrl ? (
                      <img src={project.imageUrl} alt={project.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Briefcase className="size-10 text-primary/20" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold tracking-tight">{project.title}</h3>
                    {project.featured && <Badge className="text-[9px] uppercase font-bold text-primary bg-primary/10 border-primary/20">Featured</Badge>}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground leading-relaxed">
                      {project.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {project.techStack.map((tech) => (
                        <Badge key={tech} variant="outline" className="text-[10px] font-medium opacity-80">{tech}</Badge>
                      ))}
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                      {project.githubUrl && (
                        <Button asChild variant="outline" size="sm" className="flex-1 rounded-xl glass-morphism">
                          <a href={project.githubUrl} target="_blank" rel="noreferrer">
                            <Github className="mr-2 size-4" />
                            Source
                          </a>
                        </Button>
                      )}
                      {project.liveUrl && (
                        <Button asChild size="sm" className="flex-1 rounded-xl shadow-lg shadow-primary/10">
                          <a href={project.liveUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 size-4" />
                            Live
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {profile.studentProfile.projects.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
                    <Briefcase className="size-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 font-semibold">No projects yet</h3>
                  <p className="text-sm text-muted-foreground">Projects will appear here once added to the profile.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="achievements" className="mt-0 space-y-10">
            <section>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Timeline</h2>
                  <p className="text-sm text-muted-foreground">Important milestones and recognitions</p>
                </div>
              </div>
              <div className="relative space-y-8 pl-8 before:absolute before:left-0 before:top-2 before:h-[calc(100%-8px)] before:w-px before:bg-linear-to-b before:from-primary before:to-transparent">
                {profile.studentProfile.achievements.map((achievement, idx) => (
                  <div key={achievement.id} className="relative">
                    <div className="absolute -left-9.25 top-1.5 size-4 rounded-full border-2 border-background bg-primary ring-4 ring-primary/10" />
                    <Card className="shadow-xs transition-all hover:shadow-md">
                      <CardContent className="p-5">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="text-lg font-bold">{achievement.title}</h3>
                            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                              <Badge variant="outline" className="px-1.5 py-0">{achievement.category}</Badge>
                              <div className="flex items-center gap-1">
                                <Calendar className="size-3" />
                                {new Date(achievement.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                              </div>
                            </div>
                          </div>
                          {achievement.certificateUrl && (
                            <Button asChild variant="link" className="p-0 text-primary">
                              <a href={achievement.certificateUrl} target="_blank" rel="noreferrer">
                                <LinkIcon className="mr-2 size-4" />
                                View Certificate
                              </a>
                            </Button>
                          )}
                        </div>
                        {achievement.description && (
                          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{achievement.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}

                {profile.studentProfile.achievements.length === 0 && (
                  <p className="py-10 text-center text-muted-foreground italic">No achievements recorded yet.</p>
                )}
              </div>
            </section>

            {profile.certificates && profile.certificates.length > 0 && (
              <section>
                <h2 className="mb-6 text-2xl font-bold tracking-tight">Verified Certifications</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {profile.certificates.map((cert) => (
                    <div key={cert.id} className="flex items-start gap-4 rounded-3xl border bg-card p-5 transition-shadow hover:shadow-md">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Award className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-bold">{cert.title}</h4>
                        <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide mt-1">{cert.type}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Issued {new Date(cert.issuedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </p>
                        {cert.externalUrl && (
                          <a href={cert.externalUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                            Verify 
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {profile.studentProfile.resumeUrl && (
              <Card className="mt-12 border-primary/20 bg-primary/5">
                <CardContent className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                      <Award className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">Professional Resume</h3>
                      <p className="text-sm text-muted-foreground">Available for download or viewing</p>
                    </div>
                  </div>
                  <Button asChild size="lg" className="rounded-2xl px-8 shadow-xl shadow-primary/10">
                    <a href={profile.studentProfile.resumeUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 size-5" />
                      Open Resume PDF
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
             <div className="grid gap-6 md:grid-cols-2">
               {/* LeetCode detailed Stats */}
               <Card className="shadow-sm">
                 <CardHeader className="flex flex-row items-center justify-between">
                   <div>
                     <CardTitle className="text-lg">LeetCode Performance</CardTitle>
                     <CardDescription>Handle: {profile.studentProfile.leetcodeUsername ?? "N/A"}</CardDescription>
                   </div>
                   <Code2 className="size-6 text-primary" />
                 </CardHeader>
                 <CardContent>
                   <div className="space-y-4">
                     <div className="grid grid-cols-3 gap-3">
                       <div className="space-y-1 rounded-2xl bg-emerald-500/5 p-4 text-center">
                         <span className="text-[10px] uppercase font-bold text-emerald-600">Easy</span>
                         <p className="text-2xl font-bold">{profile.studentProfile.leetcodeEasy}</p>
                       </div>
                       <div className="space-y-1 rounded-2xl bg-amber-500/5 p-4 text-center">
                         <span className="text-[10px] uppercase font-bold text-amber-600">Medium</span>
                         <p className="text-2xl font-bold">{profile.studentProfile.leetcodeMedium}</p>
                       </div>
                       <div className="space-y-1 rounded-2xl bg-rose-500/5 p-4 text-center">
                         <span className="text-[10px] uppercase font-bold text-rose-600">Hard</span>
                         <p className="text-2xl font-bold">{profile.studentProfile.leetcodeHard}</p>
                       </div>
                     </div>
                     <div className="space-y-2">
                       <div className="flex justify-between text-sm">
                         <span className="text-muted-foreground">Total Solved</span>
                         <span className="font-semibold">{leetcodeSolved}</span>
                       </div>
                       <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                         <div
                           className="flex h-full rounded-full"
                           style={{ width: "100%" }}
                         >
                            <div className="bg-emerald-500" style={{ width: `${leetcodeDistribution.easy}%` }} />
                            <div className="bg-amber-500" style={{ width: `${leetcodeDistribution.medium}%` }} />
                            <div className="bg-rose-500" style={{ width: `${leetcodeDistribution.hard}%` }} />
                         </div>
                       </div>
                       <div className="flex justify-between text-xs text-muted-foreground">
                         <span>Acceptance</span>
                         <span>
                           {typeof profile.studentProfile.leetcodeAcceptanceRate === "number"
                             ? `${profile.studentProfile.leetcodeAcceptanceRate.toFixed(2)}%`
                             : "N/A"}
                         </span>
                       </div>
                     </div>
                   </div>
                 </CardContent>
               </Card>

               {/* Competitive platforms ratings */}
               <Card className="shadow-sm">
                 <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Competitive Programming</CardTitle>
                      <CardDescription>Global rankings and ratings</CardDescription>
                    </div>
                    <Trophy className="size-6 text-primary" />
                 </CardHeader>
                 <CardContent>
                   <div className="space-y-4">
                     <div className="flex items-center justify-between rounded-2xl border p-4">
                       <div className="flex items-center gap-3">
                         <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                           <Trophy className="size-5 text-amber-600" />
                         </div>
                         <div>
                           <p className="text-sm font-bold">CodeChef</p>
                           <p className="text-xs text-muted-foreground">@{profile.studentProfile.codechefUsername ?? "N/A"}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-xl font-bold">{profile.studentProfile.codechefRating ?? "N/A"}</p>
                         <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Current Rating</p>
                         <p className="mt-1 text-xs text-muted-foreground">
                           Max {profile.studentProfile.codechefMaxRating ?? "N/A"}
                           {" • "}
                           {profile.studentProfile.codechefStars
                             ? `${profile.studentProfile.codechefStars}★`
                             : "Unrated"}
                         </p>
                       </div>
                     </div>

                     <div className="flex items-center justify-between rounded-2xl border p-4">
                       <div className="flex items-center gap-3">
                         <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                           <Award className="size-5 text-blue-600" />
                         </div>
                         <div>
                           <p className="text-sm font-bold">Codeforces</p>
                           <p className="text-xs text-muted-foreground">@{profile.studentProfile.codeforcesUsername ?? "N/A"}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-xl font-bold">{profile.studentProfile.codeforcesRating ?? "N/A"}</p>
                         <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Current Rating</p>
                         <p className="mt-1 text-xs text-muted-foreground">
                           Max {profile.studentProfile.codeforcesMaxRating ?? "N/A"}
                           {" • "}
                           {profile.studentProfile.codeforcesRank ?? "Unrated"}
                         </p>
                       </div>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
