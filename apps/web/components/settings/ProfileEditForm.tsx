"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ActivityHeatmap } from "@repo/ui/charts/ActivityHeatmap";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { type ApiResponse, Role } from "@repo/types";
import { Github, Plus, RefreshCcw, Trash2, Upload } from "lucide-react";

interface EditProfileData {
  id: string;
  avatar?: string | null;
  profile?: {
    handle?: string | null;
    phoneNumber?: string | null;
  } | null;
  studentProfile: {
    bio?: string | null;
    cgpa?: number | null;
    isPublic: boolean;
    resumeUrl?: string | null;
    resumeFilename?: string | null;
    lastSyncedAt?: string | null;
    githubUsername?: string | null;
    leetcodeUsername?: string | null;
    codechefUsername?: string | null;
    codeforcesUsername?: string | null;
    hackerrankUsername?: string | null;
    activityHeatmap?: Record<string, number> | null;
    skills: Array<{
      id: string;
      name: string;
      category: string;
      level: string;
    }>;
    projects: Array<{
      id: string;
      title: string;
      description: string;
      techStack: string[];
    }>;
    achievements: Array<{
      id: string;
      title: string;
      category: string;
      description?: string | null;
      date: string;
    }>;
  };
}

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProfileEditPageProps {
  initialTab?: string;
}

export default function ProfileEditPage({ initialTab }: ProfileEditPageProps) {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState(initialTab || "basic");

  // Sync activeTab if initialTab changes (parent controlled)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? "",
    handle: user?.profile?.handle ?? "",
    phoneNumber: user?.profile?.phoneNumber ?? "",
    bio: "",
    cgpa: "",
    isPublic: true,
    githubUsername: "",
    leetcodeUsername: "",
    codechefUsername: "",
    codeforcesUsername: "",
    hackerrankUsername: "",
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [skillForm, setSkillForm] = useState({
    name: "",
    category: "Frontend",
    level: "BEGINNER",
  });
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    techStack: "",
  });
  const [achievementForm, setAchievementForm] = useState({
    title: "",
    category: "Hackathon",
    description: "",
    date: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["profile", "edit", user?.id],
    queryFn: () =>
      api.get<ApiResponse<EditProfileData>>(`/api/profile/${user!.id}`),
    enabled: !!user?.id,
  });

  useEffect(() => {
    const studentProfile = data?.data?.studentProfile;
    if (!studentProfile) return;

    setProfileForm((prev) => ({
      ...prev,
      phoneNumber: data?.data?.profile?.phoneNumber ?? prev.phoneNumber,
      bio: studentProfile.bio ?? "",
      cgpa: studentProfile.cgpa?.toString() ?? "",
      isPublic: studentProfile.isPublic,
      githubUsername: studentProfile.githubUsername ?? "",
      leetcodeUsername: studentProfile.leetcodeUsername ?? "",
      codechefUsername: studentProfile.codechefUsername ?? "",
      codeforcesUsername: studentProfile.codeforcesUsername ?? "",
      hackerrankUsername: studentProfile.hackerrankUsername ?? "",
    }));
  }, [data?.data?.studentProfile]);

  // Combined mutation for both Auth info and Student Profile
  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      // 1. Update basic identity (name, handle) if changed
      if (
        payload.name !== user?.name ||
        payload.handle !== user?.profile?.handle ||
        payload.phoneNumber !== user?.profile?.phoneNumber
      ) {
        await api.patch("/api/profile/update", {
          name: payload.name,
          handle: payload.handle,
          phoneNumber: payload.phoneNumber,
        });
      }

      // 2. Update student profile
      return api.put<ApiResponse<any>>("/api/profile", payload);
    },
    onSuccess: (res: ApiResponse<any>) => {
      void queryClient.invalidateQueries({
        queryKey: ["profile", "edit", user?.id],
      });
      // Safely update local user name/handle if they changed
      if (res.data && user) {
        // Optionally merge if res.data contains the updated user
        // For now, only invalidate is sufficient to refresh the UI via React Query
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Track if we have unsaved changes to avoid infinite loops from query invalidation
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (!data?.data?.studentProfile) return;

    if (!hasUnsavedChanges) return;

    const timeout = window.setTimeout(() => {
      updateMutation.mutate({
        name: profileForm.name,
        handle: profileForm.handle,
        phoneNumber: profileForm.phoneNumber,
        bio: profileForm.bio,
        ...(user?.role !== Role.STUDENT && {
          cgpa: profileForm.cgpa === "" ? null : Number(profileForm.cgpa),
        }),
        isPublic: profileForm.isPublic,
        githubUsername: profileForm.githubUsername || null,
        leetcodeUsername: profileForm.leetcodeUsername || null,
        codechefUsername: profileForm.codechefUsername || null,
        codeforcesUsername: profileForm.codeforcesUsername || null,
        hackerrankUsername: profileForm.hackerrankUsername || null,
      });
      setHasUnsavedChanges(false);
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [profileForm, hasUnsavedChanges]);

  // Set unsaved changes when form fields change locally
  const updateForm = (updates: Partial<typeof profileForm>) => {
    setProfileForm((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const syncMutation = useMutation({
    mutationFn: (platform: string) =>
      api.post("/api/profile/sync", { platform }),
    onSuccess: () => {
      toast.success("Platform sync triggered");
      void queryClient.invalidateQueries({
        queryKey: ["profile", "edit", user?.id],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addSkillMutation = useMutation({
    mutationFn: () => api.post("/api/profile/skills", skillForm),
    onSuccess: () => {
      toast.success("Skill added");
      setSkillForm({ name: "", category: "Frontend", level: "BEGINNER" });
      void queryClient.invalidateQueries({
        queryKey: ["profile", "edit", user?.id],
      });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: (skillId: string) =>
      api.delete(`/api/profile/skills/${skillId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["profile", "edit", user?.id],
      });
    },
  });

  const addProjectMutation = useMutation({
    mutationFn: () =>
      api.post("/api/profile/projects", {
        title: projectForm.title,
        description: projectForm.description,
        techStack: projectForm.techStack
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success("Project added");
      setProjectForm({ title: "", description: "", techStack: "" });
      void queryClient.invalidateQueries({
        queryKey: ["profile", "edit", user?.id],
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) =>
      api.delete(`/api/profile/projects/${projectId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["profile", "edit", user?.id],
      });
    },
  });

  const addAchievementMutation = useMutation({
    mutationFn: () =>
      api.post("/api/profile/achievements", {
        title: achievementForm.title,
        category: achievementForm.category,
        description: achievementForm.description || null,
        date: new Date(achievementForm.date).toISOString(),
      }),
    onSuccess: () => {
      toast.success("Achievement added");
      setAchievementForm({
        title: "",
        category: "Hackathon",
        description: "",
        date: "",
      });
      void queryClient.invalidateQueries({
        queryKey: ["profile", "edit", user?.id],
      });
    },
  });

  const deleteAchievementMutation = useMutation({
    mutationFn: (achievementId: string) =>
      api.delete(`/api/profile/achievements/${achievementId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["profile", "edit", user?.id],
      });
    },
  });

  const uploadResumeMutation = useMutation({
    mutationFn: async () => {
      if (!resumeFile) return null;
      const formData = new FormData();
      formData.append("file", resumeFile);
      return api.post("/api/profile/resume", formData);
    },
    onSuccess: () => {
      toast.success("Resume uploaded");
      setResumeFile(null);
      void queryClient.invalidateQueries({
        queryKey: ["profile", "edit", user?.id],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!avatarFile) return null;
      const formData = new FormData();
      formData.append("file", avatarFile);
      return api.post("/api/profile/avatar", formData);
    },
    onSuccess: () => {
      toast.success("Avatar uploaded");
      setAvatarFile(null);
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
      window.location.reload();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: () => api.delete("/api/profile/avatar"),
    onSuccess: () => {
      toast.success("Avatar removed");
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
      window.location.reload();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteResumeMutation = useMutation({
    mutationFn: () => api.delete("/api/profile/resume"),
    onSuccess: () => {
      toast.success("Resume removed");
      void queryClient.invalidateQueries({
        queryKey: ["profile", "edit", user?.id],
      });
    },
  });

  const studentProfile = data?.data?.studentProfile;
  const lastSyncedLabel = useMemo(() => {
    if (!studentProfile?.lastSyncedAt) return "Never synced";
    return new Date(studentProfile.lastSyncedAt).toLocaleString();
  }, [studentProfile?.lastSyncedAt]);

  const profileHeatmap = studentProfile?.activityHeatmap ?? null;
  const hasProfileHeatmapData = Object.keys(profileHeatmap ?? {}).length > 0;
  const { data: heatmapResponse } = useQuery({
    queryKey: ["profile", "edit", "heatmap", user?.id],
    queryFn: () =>
      api.get<ApiResponse<Record<string, number>>>(
        `/api/profile/${encodeURIComponent(user!.id)}/heatmap`
      ),
    enabled: !!user?.id && activeTab === "basic" && !hasProfileHeatmapData,
  });

  const effectiveHeatmap = useMemo(
    () => (hasProfileHeatmapData ? (profileHeatmap ?? {}) : (heatmapResponse?.data ?? {})),
    [hasProfileHeatmapData, profileHeatmap, heatmapResponse?.data]
  );
  const hasAnyHeatmapEntries = Object.keys(effectiveHeatmap).length > 0;
  const availableHeatmapYears = useMemo(() => {
    const years = Object.keys(effectiveHeatmap)
      .map((date) => Number.parseInt(date.slice(0, 4), 10))
      .filter((value) => Number.isFinite(value));
    return [...new Set(years)].sort((left, right) => right - left);
  }, [effectiveHeatmap]);
  const [selectedHeatmapYear, setSelectedHeatmapYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (availableHeatmapYears.length > 0 && !availableHeatmapYears.includes(selectedHeatmapYear)) {
      setSelectedHeatmapYear(availableHeatmapYears[0]!);
    }
  }, [availableHeatmapYears, selectedHeatmapYear]);

  const platformFields: Array<{
    field:
      | "githubUsername"
      | "leetcodeUsername"
      | "codechefUsername"
      | "codeforcesUsername"
      | "hackerrankUsername";
    label: string;
    platform: string | null;
  }> = [
    { field: "githubUsername", label: "GitHub", platform: "github" },
    { field: "leetcodeUsername", label: "LeetCode", platform: "leetcode" },
    { field: "codechefUsername", label: "CodeChef", platform: "codechef" },
    {
      field: "codeforcesUsername",
      label: "Codeforces",
      platform: "codeforces",
    },
    { field: "hackerrankUsername", label: "HackerRank", platform: null },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        {/* Inner TabsList removed - parent sidebar controls this now */}

        <TabsContent value="basic" className="m-0">
          <Card className="border-none shadow-none bg-transparent p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle>Basic Information</CardTitle>
              <p className="text-sm text-muted-foreground">
                Update your personal details and academic bio.
              </p>
            </CardHeader>
            <CardContent className="px-0 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={profileForm.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    placeholder="Your legal or preferred name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Profile Handle</Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground text-sm">
                      @
                    </span>
                    <Input
                      className="pl-7"
                      value={profileForm.handle}
                      onChange={(e) =>
                        updateForm({
                          handle: e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "_"),
                        })
                      }
                      placeholder="username"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={profileForm.phoneNumber}
                    onChange={(e) => updateForm({ phoneNumber: e.target.value })}
                    placeholder="Required for contest and hackathon registrations"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Avatar Upload</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="button" variant="outline" onClick={() => uploadAvatarMutation.mutate()} disabled={!avatarFile || uploadAvatarMutation.isPending}>
                    Upload
                  </Button>
                  {data?.data?.avatar || user?.avatar ? (
                    <Button type="button" variant="ghost" onClick={() => deleteAvatarMutation.mutate()} disabled={deleteAvatarMutation.isPending}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Biography</Label>
                <Textarea
                  className="min-h-32"
                  placeholder="Share a bit about your journey, interests, or background..."
                  value={profileForm.bio}
                  onChange={(event) => updateForm({ bio: event.target.value })}
                />
              </div>

              <div className="max-w-50 space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Current CGPA</Label>
                  {user?.role === Role.STUDENT && (
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 text-[10px] uppercase font-bold"
                    >
                      Auto-calculated
                    </Badge>
                  )}
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={profileForm.cgpa}
                  onChange={(event) => updateForm({ cgpa: event.target.value })}
                  placeholder="0.00"
                  disabled={user?.role === Role.STUDENT}
                  className={
                    user?.role === Role.STUDENT
                      ? "bg-muted/50 cursor-not-allowed opacity-80"
                      : ""
                  }
                />
                {user?.role === Role.STUDENT && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Calculated automatically from your academic performance.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Coding Activity</p>
                    <p className="text-xs text-muted-foreground">
                      Track your daily consistency and contribution momentum.
                    </p>
                  </div>
                  {availableHeatmapYears.length > 0 ? (
                    <Select
                      value={String(selectedHeatmapYear)}
                      onValueChange={(value) => setSelectedHeatmapYear(Number.parseInt(value, 10))}
                    >
                      <SelectTrigger className="h-8 w-28 rounded-full">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableHeatmapYears.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="rounded-full px-2.5">
                      {selectedHeatmapYear}
                    </Badge>
                  )}
                </div>
                {hasAnyHeatmapEntries ? (
                  <div className="overflow-x-auto">
                    <ActivityHeatmap
                      data={effectiveHeatmap}
                      year={selectedHeatmapYear}
                      className="w-full"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                    No coding activity found yet. Start solving problems to
                    build your heatmap.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platforms" className="m-0">
          <Card className="border-none shadow-none bg-transparent p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle>Coding Platforms</CardTitle>
              <p className="text-sm text-muted-foreground">
                Sync your profiles from external coding platforms to verify your
                skills.
              </p>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Last synced: {lastSyncedLabel}
              </p>
              {platformFields.map(({ field, label, platform }) => (
                <div
                  key={field}
                  className="flex flex-col gap-3 rounded-2xl border border-border p-4 md:flex-row md:items-center"
                >
                  <div className="flex items-center gap-2 font-medium md:w-40">
                    <Github className="size-4 text-primary" />
                    {label}
                  </div>
                  <Input
                    value={profileForm[field]}
                    onChange={(event) =>
                      updateForm({ [field]: event.target.value })
                    }
                    placeholder={`Enter your ${label} username`}
                  />
                  {platform ? (
                    <Button
                      variant="outline"
                      onClick={() => syncMutation.mutate(platform)}
                      disabled={syncMutation.isPending}
                    >
                      <RefreshCcw className="mr-2 size-4" />
                      Verify & Sync
                    </Button>
                  ) : (
                    <Badge
                      variant="outline"
                      className="justify-center px-3 py-2"
                    >
                      Manual only
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="m-0">
          <Card className="border-none shadow-none bg-transparent p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle>Skills</CardTitle>
              <p className="text-sm text-muted-foreground">
                List your technical expertise and proficiency levels.
              </p>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
              <div className="flex flex-wrap gap-2">
                {studentProfile?.skills.map((skill) => (
                  <Badge
                    key={skill.id}
                    variant="outline"
                    className="gap-2 py-1.5"
                  >
                    {skill.name}
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {skill.level}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSkillMutation.mutate(skill.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Input
                  placeholder="Skill name"
                  value={skillForm.name}
                  onChange={(event) =>
                    setSkillForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Category"
                  value={skillForm.category}
                  onChange={(event) =>
                    setSkillForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Level"
                  value={skillForm.level}
                  onChange={(event) =>
                    setSkillForm((current) => ({
                      ...current,
                      level: event.target.value,
                    }))
                  }
                />
                <Button
                  onClick={() => addSkillMutation.mutate()}
                  disabled={!skillForm.name}
                >
                  <Plus className="mr-2 size-4" />
                  Add Skill
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="m-0">
          <Card className="border-none shadow-none bg-transparent p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle>Projects</CardTitle>
              <p className="text-sm text-muted-foreground">
                Showcase your best work, side projects, and contributions.
              </p>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
              <div className="space-y-3">
                {studentProfile?.projects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-2xl border border-border p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{project.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {project.description}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteProjectMutation.mutate(project.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {project.techStack.map((item) => (
                        <Badge key={item} variant="outline">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3">
                <Input
                  placeholder="Project title"
                  value={projectForm.title}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
                <textarea
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Project description"
                  value={projectForm.description}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Tech stack (comma separated)"
                  value={projectForm.techStack}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      techStack: event.target.value,
                    }))
                  }
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => addProjectMutation.mutate()}
                    disabled={!projectForm.title}
                  >
                    <Plus className="mr-2 size-4" />
                    Add Project
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="m-0">
          <Card className="border-none shadow-none bg-transparent p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle>Achievements</CardTitle>
              <p className="text-sm text-muted-foreground">
                Highlight your certifications, contest wins, and honors.
              </p>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
              <div className="space-y-3">
                {studentProfile?.achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="rounded-2xl border border-border p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{achievement.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {achievement.category} •{" "}
                          {new Date(achievement.date).toLocaleDateString()}
                        </p>
                        {achievement.description && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {achievement.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          deleteAchievementMutation.mutate(achievement.id)
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Achievement title"
                  value={achievementForm.title}
                  onChange={(event) =>
                    setAchievementForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Category"
                  value={achievementForm.category}
                  onChange={(event) =>
                    setAchievementForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                />
                <Input
                  type="date"
                  value={achievementForm.date}
                  onChange={(event) =>
                    setAchievementForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Description"
                  value={achievementForm.description}
                  onChange={(event) =>
                    setAchievementForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => addAchievementMutation.mutate()}
                  disabled={!achievementForm.title || !achievementForm.date}
                >
                  <Plus className="mr-2 size-4" />
                  Add Achievement
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resume" className="m-0">
          <Card className="border-none shadow-none bg-transparent p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle>Resume & Portfolio</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload your latest resume in PDF format for potential employers.
              </p>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
              {studentProfile?.resumeUrl ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">
                      {studentProfile.resumeFilename ?? "Uploaded resume"}
                    </p>
                    <a
                      href={studentProfile.resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Open current resume
                    </a>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => deleteResumeMutation.mutate()}
                    disabled={deleteResumeMutation.isPending}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete Resume
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-4 md:flex-row md:items-center">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(event) =>
                    setResumeFile(event.target.files?.[0] ?? null)
                  }
                />
                <Button
                  onClick={() => uploadResumeMutation.mutate()}
                  disabled={!resumeFile || uploadResumeMutation.isPending}
                >
                  <Upload className="mr-2 size-4" />
                  Upload Resume
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="m-0">
          <Card className="border-none shadow-none bg-transparent p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle>Privacy Control</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage who can see your profile and activity.
              </p>
            </CardHeader>
            <CardContent className="px-0">
              <label className="flex items-center gap-3 rounded-2xl border border-border p-4">
                <input
                  type="checkbox"
                  checked={profileForm.isPublic}
                  onChange={(event) =>
                    updateForm({ isPublic: event.target.checked })
                  }
                />
                <div>
                  <p className="font-medium">Public profile visibility</p>
                  <p className="text-sm text-muted-foreground">
                    When enabled, your `/u/{user?.profile?.handle ?? "username"}
                    ` page is visible to others.
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {updateMutation.isPending ? (
            <RefreshCcw className="size-3.5 animate-spin" />
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] font-bold uppercase tracking-wider"
            >
              Auto-saved
            </Badge>
          )}
          <span>
            {updateMutation.isPending
              ? "Saving changes..."
              : "All changes saved"}
          </span>
        </div>
        <Button
          onClick={() => {
            updateMutation.mutate({
              name: profileForm.name,
              handle: profileForm.handle,
              bio: profileForm.bio,
              ...(user?.role !== Role.STUDENT && {
                cgpa: profileForm.cgpa === "" ? null : Number(profileForm.cgpa),
              }),
              isPublic: profileForm.isPublic,
              githubUsername: profileForm.githubUsername || null,
              leetcodeUsername: profileForm.leetcodeUsername || null,
              codechefUsername: profileForm.codechefUsername || null,
              codeforcesUsername: profileForm.codeforcesUsername || null,
              hackerrankUsername: profileForm.hackerrankUsername || null,
            });
            toast.success("Profile saved successfully");
          }}
          disabled={updateMutation.isPending}
          className="rounded-xl px-8"
        >
          {updateMutation.isPending ? "Saving..." : "Save & Finish"}
        </Button>
        {user?.role === Role.STUDENT && (
          <Button
            variant="outline"
            onClick={() => {
              void queryClient.invalidateQueries({
                queryKey: ["profile", "edit", user?.id],
              });
              toast.info("CGPA refreshed from academic records");
            }}
            className="rounded-xl px-4"
          >
            <RefreshCcw className="mr-2 size-4" />
            Refresh CGPA
          </Button>
        )}
      </div>

      {isLoading && (
        <Card className="border-none shadow-none bg-muted/30">
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            <RefreshCcw className="mx-auto mb-3 size-6 animate-spin text-primary/40" />
            Synchronizing your profile data...
          </CardContent>
        </Card>
      )}
    </div>
  );
}
