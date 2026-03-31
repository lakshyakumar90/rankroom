"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ApiResponse } from "@repo/types";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, GraduationCap, Code2, ShieldAlert } from "lucide-react";

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState("");
  const [handle, setHandle] = useState(user?.profile?.handle ?? "");
  const [githubUsername, setGithubUsername] = useState(user?.githubUsername ?? "");
  const [college, setCollege] = useState(user?.profile?.college ?? "");
  const [batch, setBatch] = useState(user?.profile?.batch ?? "");
  const [department, setDepartment] = useState(user?.profile?.department ?? "");
  const [isPublic, setIsPublic] = useState(user?.profile?.isPublic ?? false);
  const [loading, setLoading] = useState(false);

  const isStudent = user?.role === "STUDENT";
  const primaryEnrollment = user?.enrollments?.[0]?.section;
  const canEditAcademicIdentity = !isStudent;

  useEffect(() => {
    setName(user?.name ?? "");
    setHandle(user?.profile?.handle ?? "");
    setGithubUsername(user?.githubUsername ?? "");
    setCollege(user?.profile?.college ?? "");
    setBatch(user?.profile?.batch ?? "");
    setDepartment(user?.profile?.department ?? "");
    setIsPublic(user?.profile?.isPublic ?? false);
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const me = await api.get<
          ApiResponse<{
            name: string;
            githubUsername?: string | null;
            profile?: {
              handle?: string | null;
              bio?: string | null;
              isPublic: boolean;
              college?: string | null;
              batch?: string | null;
              department?: string | null;
            } | null;
          }>
        >("/api/auth/me");

        if (cancelled || !me.data) return;

        setName(me.data.name);
        setHandle(me.data.profile?.handle ?? "");
        setBio(me.data.profile?.bio ?? "");
        setGithubUsername(me.data.githubUsername ?? "");
        setCollege(me.data.profile?.college ?? "");
        setBatch(me.data.profile?.batch ?? "");
        setDepartment(me.data.profile?.department ?? "");
        setIsPublic(me.data.profile?.isPublic ?? false);
      } catch {
        // fallback to store
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const academicFields = useMemo(
    () => [
      { label: "Section", value: primaryEnrollment?.name ?? "Not assigned" },
      { label: "Course / Code", value: primaryEnrollment?.code ?? "Not assigned" },
      { label: "Department", value: primaryEnrollment?.department?.name ?? (department || "Not assigned") },
      { label: "Sessional year", value: primaryEnrollment?.academicYear ?? (batch || "Not assigned") },
    ],
    [batch, department, primaryEnrollment]
  );

  async function handleSave() {
    setLoading(true);
    try {
      await api.patch("/api/auth/profile", {
        name,
        handle,
        bio,
        githubUsername,
        college,
        batch,
        department,
        isPublic,
      });
      const me = await api.get<ApiResponse<NonNullable<typeof user>>>("/api/auth/me");
      if (me.data) setUser(me.data as Parameters<typeof setUser>[0]);
      toast.success("Settings updated");
    } catch {
      toast.error("Failed to update settings");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile, academic identity, and preferences.</p>
      </div>

      <Tabs defaultValue="general" className="flex flex-col md:flex-row gap-8">
        <TabsList className="flex md:flex-col h-auto justify-start self-start bg-transparent p-0 w-full md:w-56 gap-1 md:border-r border-border md:pr-6 pb-4 md:pb-0 overflow-x-auto">
          <TabsTrigger value="general" className="justify-start data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground px-4 py-2.5 w-full text-left gap-2 rounded-lg">
            <User className="size-4" /> General Profile
          </TabsTrigger>
          <TabsTrigger value="academic" className="justify-start data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground px-4 py-2.5 w-full text-left gap-2 rounded-lg">
            <GraduationCap className="size-4" /> Academic Info
          </TabsTrigger>
          <TabsTrigger value="developer" className="justify-start data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground px-4 py-2.5 w-full text-left gap-2 rounded-lg">
            <Code2 className="size-4" /> Developer Data
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 space-y-6">
          {/* General Tab */}
          <TabsContent value="general" className="mt-0 space-y-6 animate-in fade-in-50">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Public Profile</CardTitle>
                <CardDescription>This is how others will see you on the platform.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-5 rounded-xl border border-border/50 bg-muted/20 p-5">
                  <Avatar src={user?.avatar} name={user?.name} size="lg" className="size-16" />
                  <div>
                    <p className="text-lg font-semibold">{user?.name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <div className="mt-2 text-xs uppercase tracking-widest text-primary font-semibold">{user?.role?.replaceAll("_", " ")}</div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Full name" htmlFor="name">
                    <Input id="name" value={name} onChange={(event) => setName(event.target.value)} disabled={!canEditAcademicIdentity && isStudent} />
                  </Field>
                  <Field label="Public handle" htmlFor="handle">
                    <Input id="handle" value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="@username" />
                  </Field>
                </div>

                <Field label="Bio" htmlFor="bio">
                  <Textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} placeholder="A short description about yourself" className="resize-none" rows={4} />
                </Field>

                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/10 p-5">
                  <div className="space-y-0.5">
                    <Label className="text-base">Public Visibility</Label>
                    <p className="text-sm text-muted-foreground">Make your profile accessible to anyone via your handle.</p>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label="Toggle public profile" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Academic Tab */}
          <TabsContent value="academic" className="mt-0 space-y-6 animate-in fade-in-50">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Academic Enrollment</CardTitle>
                <CardDescription>Your registered academic details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {academicFields.map((field) => (
                    <div key={field.label} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{field.label}</p>
                      <p className="mt-1.5 font-medium">{field.value}</p>
                    </div>
                  ))}
                </div>
                {isStudent && (
                  <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-blue-600 dark:text-blue-400">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <p className="text-sm leading-relaxed">
                      Core academic fields are managed by administrators. Please contact your coordinator to update section or department mappings.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Academic Descriptors</CardTitle>
                <CardDescription>Additional context for your institution.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="College / Institute" htmlFor="college">
                  <Input id="college" value={college} onChange={(event) => setCollege(event.target.value)} />
                </Field>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Batch / Session" htmlFor="batch">
                    <Input id="batch" value={batch} onChange={(event) => setBatch(event.target.value)} disabled={!canEditAcademicIdentity} />
                  </Field>
                  <Field label="Department Alias" htmlFor="department">
                    <Input id="department" value={department} onChange={(event) => setDepartment(event.target.value)} disabled={!canEditAcademicIdentity} />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Developer Tab */}
          <TabsContent value="developer" className="mt-0 space-y-6 animate-in fade-in-50">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Developer Integrations</CardTitle>
                <CardDescription>Connect external platforms to showcase your experience.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="GitHub Username" htmlFor="github">
                  <div className="flex">
                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-border bg-muted/50 px-3 text-sm text-muted-foreground">github.com/</span>
                    <Input id="github" value={githubUsername} onChange={(event) => setGithubUsername(event.target.value)} className="rounded-l-none" />
                  </div>
                </Field>
                <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30 border border-border/50">
                  Linking your GitHub account enables activity syncing with the platform heatmap.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={loading} className="px-8 font-medium">
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
