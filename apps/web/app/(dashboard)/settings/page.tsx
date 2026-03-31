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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="mx-auto grid max-w-5xl gap-6 xl:grid-cols-[1.25fr,0.75fr]">
      <Card>
        <CardHeader>
          <CardTitle>Personal Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4 border border-border p-4">
            <Avatar src={user?.avatar} name={user?.name} size="lg" />
            <div>
              <p className="text-base font-semibold">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{user?.role?.replaceAll("_", " ")}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name" htmlFor="name">
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} disabled={!canEditAcademicIdentity && isStudent} />
            </Field>
            <Field label="Public handle" htmlFor="handle">
              <Input id="handle" value={handle} onChange={(event) => setHandle(event.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="GitHub username" htmlFor="github">
              <Input id="github" value={githubUsername} onChange={(event) => setGithubUsername(event.target.value)} />
            </Field>
            <Field label="College / institute" htmlFor="college">
              <Input id="college" value={college} onChange={(event) => setCollege(event.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Batch / session" htmlFor="batch">
              <Input id="batch" value={batch} onChange={(event) => setBatch(event.target.value)} disabled={!canEditAcademicIdentity} />
            </Field>
            <Field label="Department label" htmlFor="department">
              <Input id="department" value={department} onChange={(event) => setDepartment(event.target.value)} disabled={!canEditAcademicIdentity} />
            </Field>
          </div>

          <Field label="Bio" htmlFor="bio">
            <Textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} />
          </Field>

          <div className="flex items-center justify-between border border-border p-4">
            <div>
              <p className="text-sm font-semibold">Public profile</p>
              <p className="text-sm text-muted-foreground">Choose whether your profile is visible to others.</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label="Toggle public profile" />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Academic identity fields are managed by teachers or academic admins. Students can review them here.
          </p>
          {academicFields.map((field) => (
            <div key={field.label} className="border border-border p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{field.label}</p>
              <p className="mt-1 text-sm font-medium">{field.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
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
