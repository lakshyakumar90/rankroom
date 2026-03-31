"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityHeatmap } from "@repo/ui/charts/ActivityHeatmap";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";

interface PublicProfileData {
  id: string;
  name: string;
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
    githubContributions: number;
    githubTopLanguages?: Array<{ name: string; count: number }> | null;
    codechefRating?: number | null;
    codeforcesRating?: number | null;
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
}

function StatChip({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Code2;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm">
      <Icon className="size-4 text-primary" />
      <span className="font-medium">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function platformLink(label: string, href: string, icon: React.ReactNode) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

export function PublicProfileView({ username }: { username: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () =>
      api.get<ApiResponse<PublicProfileData>>(
        `/api/users/public/${encodeURIComponent(decodeURIComponent(username))}`
      ),
  });

  const profile = data?.data ?? null;

  const availableYears = useMemo(() => {
    if (!profile?.studentProfile.activityHeatmap) return [new Date().getFullYear()];
    const years = Object.keys(profile.studentProfile.activityHeatmap).map((date) =>
      Number.parseInt(date.slice(0, 4), 10)
    );
    return [...new Set(years)].sort((left, right) => right - left);
  }, [profile?.studentProfile.activityHeatmap]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (availableYears.length > 0) {
      setSelectedYear((current) =>
        availableYears.includes(current) ? current : availableYears[0]!
      );
    }
  }, [availableYears]);

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
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6 py-16 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This profile is unavailable or no longer public.
          </p>
        </div>
      </div>
    );
  }

  const primaryEnrollment = profile.enrollments?.[0]?.section;
  const hackathonCount = profile.studentProfile.achievements.filter(
    (achievement) => achievement.category.toLowerCase() === "hackathon"
  ).length;

  return (
    <div className="bg-background">
      <section className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <Avatar
                src={profile.avatar}
                name={profile.name}
                size="lg"
                className="size-20 text-2xl"
              />
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">{profile.name}</h1>
                  <Badge variant="secondary">{profile.role.replaceAll("_", " ")}</Badge>
                  {primaryEnrollment && (
                    <Badge variant="outline">
                      {primaryEnrollment.department.code} • {primaryEnrollment.code}
                    </Badge>
                  )}
                </div>
                {profile.studentProfile.bio && (
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {profile.studentProfile.bio}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {skillsByCategory.map(([category, skills]) => (
                    <div key={category} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {category}
                      </span>
                      {skills.map((skill) => (
                        <Badge key={skill.id} variant="outline" className="gap-2">
                          {skill.name}
                          <span className="text-[10px] uppercase text-muted-foreground">
                            {skill.level}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
              {profile.studentProfile.githubUsername &&
                platformLink(
                  "GitHub",
                  `https://github.com/${profile.studentProfile.githubUsername}`,
                  <Github className="size-4" />
                )}
              {profile.studentProfile.leetcodeUsername &&
                platformLink(
                  "LeetCode",
                  `https://leetcode.com/${profile.studentProfile.leetcodeUsername}`,
                  <Code2 className="size-4" />
                )}
              {profile.studentProfile.codechefUsername &&
                platformLink(
                  "CodeChef",
                  `https://www.codechef.com/users/${profile.studentProfile.codechefUsername}`,
                  <Trophy className="size-4" />
                )}
              {profile.studentProfile.codeforcesUsername &&
                platformLink(
                  "Codeforces",
                  `https://codeforces.com/profile/${profile.studentProfile.codeforcesUsername}`,
                  <Award className="size-4" />
                )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <StatChip
              label="Problems Solved"
              value={profile.leaderboard?.problemsSolved ?? profile.studentProfile.leetcodeSolved}
              icon={Code2}
            />
            <StatChip
              label="GitHub Contributions"
              value={profile.studentProfile.githubContributions}
              icon={Github}
            />
            <StatChip label="Hackathons" value={hackathonCount} icon={Trophy} />
            <StatChip
              label="Projects"
              value={profile.studentProfile.projects.length}
              icon={Users}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Activity Heatmap</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Unified activity merged across coding platforms and RankRoom.
              </p>
            </div>
            <div className="w-full sm:w-36">
              <Select
                value={String(selectedYear)}
                onValueChange={(value) => setSelectedYear(Number.parseInt(value, 10))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ActivityHeatmap
              year={selectedYear}
              data={profile.studentProfile.activityHeatmap}
            />
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>LeetCode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold">{profile.studentProfile.leetcodeSolved}</p>
                <p className="text-sm text-muted-foreground">Total solved</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-500">Easy</span>
                  <span>{profile.studentProfile.leetcodeEasy}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-500">Medium</span>
                  <span>{profile.studentProfile.leetcodeMedium}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-rose-500">Hard</span>
                  <span>{profile.studentProfile.leetcodeHard}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GitHub</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold">
                  {profile.studentProfile.githubContributions}
                </p>
                <p className="text-sm text-muted-foreground">Contributions</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(profile.studentProfile.githubTopLanguages ?? []).length > 0 ? (
                  (profile.studentProfile.githubTopLanguages ?? []).map((language) => (
                    <Badge key={language.name} variant="outline">
                      {language.name}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Top languages will appear after sync.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Competitive Profiles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">CodeChef rating</span>
                <span className="font-semibold">
                  {profile.studentProfile.codechefRating ?? "Not linked"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Codeforces rating</span>
                <span className="font-semibold">
                  {profile.studentProfile.codeforcesRating ?? "Not linked"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">CGPA</span>
                <span className="font-semibold">
                  {profile.studentProfile.cgpa ?? "Not available"}
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Featured work and recent builds.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {profile.studentProfile.projects.map((project) => (
              <Card key={project.id} className="overflow-hidden">
                <div
                  className="h-36 w-full"
                  style={{
                    background:
                      project.imageUrl
                        ? undefined
                        : "linear-gradient(135deg, rgba(59,130,246,0.28), rgba(34,197,94,0.2), rgba(251,191,36,0.18))",
                  }}
                >
                  {project.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.imageUrl}
                      alt={project.title}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <CardContent className="space-y-4 p-5">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">{project.title}</h3>
                      {project.featured && <Badge>Featured</Badge>}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project.techStack.map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project.githubUrl && (
                      <Button asChild variant="outline" size="sm">
                        <a href={project.githubUrl} target="_blank" rel="noreferrer">
                          <Github className="mr-2 size-4" />
                          GitHub
                        </a>
                      </Button>
                    )}
                    {project.liveUrl && (
                      <Button asChild size="sm">
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
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Achievements</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Milestones across hackathons, competitions, and academics.
            </p>
          </div>
          <div className="space-y-6">
            {profile.studentProfile.achievements.map((achievement) => (
              <div key={achievement.id} className="relative pl-8">
                <span className="absolute left-2 top-1.5 size-3 rounded-full bg-primary" />
                <span className="absolute left-[13px] top-5 h-full w-px bg-border" />
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold">{achievement.title}</h3>
                    <Badge variant="outline">{achievement.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(achievement.date).toLocaleDateString()}
                    </span>
                  </div>
                  {achievement.description && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {achievement.description}
                    </p>
                  )}
                  {achievement.certificateUrl && (
                    <a
                      href={achievement.certificateUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <LinkIcon className="size-4" />
                      View certificate
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {profile.studentProfile.resumeUrl && (
          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Resume</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Public resume preview and download.
              </p>
            </div>
            <Card>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">
                    {profile.studentProfile.resumeFilename ?? "Resume"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PDF hosted on secure storage.
                  </p>
                </div>
                <Button asChild>
                  <a href={profile.studentProfile.resumeUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 size-4" />
                    Open Resume
                  </a>
                </Button>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
