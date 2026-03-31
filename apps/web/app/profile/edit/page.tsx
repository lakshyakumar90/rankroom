"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { ApiResponse } from "@repo/types";
import { Github, Plus, RefreshCcw, Trash2, Upload } from "lucide-react";

interface EditProfileData {
  id: string;
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
    skills: Array<{ id: string; name: string; category: string; level: string }>;
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

export default function ProfileEditPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState("basic");
  const [profileForm, setProfileForm] = useState({
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
    queryFn: () => api.get<ApiResponse<EditProfileData>>(`/api/profile/${user!.id}`),
    enabled: !!user?.id,
  });

  useEffect(() => {
    const studentProfile = data?.data?.studentProfile;
    if (!studentProfile) return;

    setProfileForm({
      bio: studentProfile.bio ?? "",
      cgpa: studentProfile.cgpa?.toString() ?? "",
      isPublic: studentProfile.isPublic,
      githubUsername: studentProfile.githubUsername ?? "",
      leetcodeUsername: studentProfile.leetcodeUsername ?? "",
      codechefUsername: studentProfile.codechefUsername ?? "",
      codeforcesUsername: studentProfile.codeforcesUsername ?? "",
      hackerrankUsername: studentProfile.hackerrankUsername ?? "",
    });
  }, [data?.data?.studentProfile]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/api/profile", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!data?.data?.studentProfile) return;

    const timeout = window.setTimeout(() => {
      updateMutation.mutate({
        bio: profileForm.bio,
        cgpa: profileForm.cgpa === "" ? null : Number(profileForm.cgpa),
        isPublic: profileForm.isPublic,
        githubUsername: profileForm.githubUsername || null,
        leetcodeUsername: profileForm.leetcodeUsername || null,
        codechefUsername: profileForm.codechefUsername || null,
        codeforcesUsername: profileForm.codeforcesUsername || null,
        hackerrankUsername: profileForm.hackerrankUsername || null,
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [data?.data?.studentProfile, profileForm]);

  const syncMutation = useMutation({
    mutationFn: (platform: string) => api.post("/api/profile/sync", { platform }),
    onSuccess: () => {
      toast.success("Platform sync triggered");
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addSkillMutation = useMutation({
    mutationFn: () => api.post("/api/profile/skills", skillForm),
    onSuccess: () => {
      toast.success("Skill added");
      setSkillForm({ name: "", category: "Frontend", level: "BEGINNER" });
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: (skillId: string) => api.delete(`/api/profile/skills/${skillId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
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
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => api.delete(`/api/profile/projects/${projectId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
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
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
    },
  });

  const deleteAchievementMutation = useMutation({
    mutationFn: (achievementId: string) => api.delete(`/api/profile/achievements/${achievementId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
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
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteResumeMutation = useMutation({
    mutationFn: () => api.delete("/api/profile/resume"),
    onSuccess: () => {
      toast.success("Resume removed");
      void queryClient.invalidateQueries({ queryKey: ["profile", "edit", user?.id] });
    },
  });

  const studentProfile = data?.data?.studentProfile;
  const lastSyncedLabel = useMemo(() => {
    if (!studentProfile?.lastSyncedAt) return "Never synced";
    return new Date(studentProfile.lastSyncedAt).toLocaleString();
  }, [studentProfile?.lastSyncedAt]);

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
    { field: "codeforcesUsername", label: "Codeforces", platform: "codeforces" },
    { field: "hackerrankUsername", label: "HackerRank", platform: null },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your public portfolio, coding handles, and supporting material.
          </p>
        </div>
        <Badge variant="outline">
          {updateMutation.isPending ? "Saving..." : "Saved"}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex w-full flex-wrap justify-start gap-2">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="platforms">Coding Platforms</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">Bio</label>
                <textarea
                  className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={profileForm.bio}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, bio: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">CGPA</label>
                <Input
                  value={profileForm.cgpa}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, cgpa: event.target.value }))
                  }
                  placeholder="8.7"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platforms">
          <Card>
            <CardHeader>
              <CardTitle>Coding Platforms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Last synced: {lastSyncedLabel}</p>
              {platformFields.map(({ field, label, platform }) => (
                <div key={field} className="flex flex-col gap-3 rounded-2xl border border-border p-4 md:flex-row md:items-center">
                  <div className="flex items-center gap-2 font-medium md:w-40">
                    <Github className="size-4 text-primary" />
                    {label}
                  </div>
                  <Input
                    value={profileForm[field]}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
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
                    <Badge variant="outline" className="justify-center px-3 py-2">
                      Manual only
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills">
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {studentProfile?.skills.map((skill) => (
                  <Badge key={skill.id} variant="outline" className="gap-2 py-1.5">
                    {skill.name}
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {skill.level}
                    </span>
                    <button type="button" onClick={() => deleteSkillMutation.mutate(skill.id)}>
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
                    setSkillForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
                <Input
                  placeholder="Category"
                  value={skillForm.category}
                  onChange={(event) =>
                    setSkillForm((current) => ({ ...current, category: event.target.value }))
                  }
                />
                <Input
                  placeholder="Level"
                  value={skillForm.level}
                  onChange={(event) =>
                    setSkillForm((current) => ({ ...current, level: event.target.value }))
                  }
                />
                <Button onClick={() => addSkillMutation.mutate()} disabled={!skillForm.name}>
                  <Plus className="mr-2 size-4" />
                  Add Skill
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {studentProfile?.projects.map((project) => (
                  <div key={project.id} className="rounded-2xl border border-border p-4">
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
                    setProjectForm((current) => ({ ...current, title: event.target.value }))
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
                    setProjectForm((current) => ({ ...current, techStack: event.target.value }))
                  }
                />
                <div className="flex justify-end">
                  <Button onClick={() => addProjectMutation.mutate()} disabled={!projectForm.title}>
                    <Plus className="mr-2 size-4" />
                    Add Project
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements">
          <Card>
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {studentProfile?.achievements.map((achievement) => (
                  <div key={achievement.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{achievement.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {achievement.category} • {new Date(achievement.date).toLocaleDateString()}
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
                        onClick={() => deleteAchievementMutation.mutate(achievement.id)}
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
                    setAchievementForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
                <Input
                  placeholder="Category"
                  value={achievementForm.category}
                  onChange={(event) =>
                    setAchievementForm((current) => ({ ...current, category: event.target.value }))
                  }
                />
                <Input
                  type="date"
                  value={achievementForm.date}
                  onChange={(event) =>
                    setAchievementForm((current) => ({ ...current, date: event.target.value }))
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

        <TabsContent value="resume">
          <Card>
            <CardHeader>
              <CardTitle>Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-3 rounded-2xl border border-border p-4">
                <input
                  type="checkbox"
                  checked={profileForm.isPublic}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      isPublic: event.target.checked,
                    }))
                  }
                />
                <div>
                  <p className="font-medium">Public profile visibility</p>
                  <p className="text-sm text-muted-foreground">
                    When enabled, your `/u/{user?.profile?.handle ?? "username"}` page is visible to others.
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isLoading && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading your profile editor...
          </CardContent>
        </Card>
      )}
    </div>
  );
}
