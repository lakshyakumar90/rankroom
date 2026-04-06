"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { ApiResponse } from "@repo/types";
import { Camera, Trash2, User as UserIcon } from "lucide-react";

export function CommonProfileSettings() {
  const { user, setUser } = useAuthStore();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarPreview = useMemo(() => {
    if (avatarFile) {
      return URL.createObjectURL(avatarFile);
    }
    return user?.avatar ?? null;
  }, [avatarFile, user?.avatar]);

  const [form, setForm] = useState({
    name: user?.name ?? "",
    bio: user?.profile?.bio ?? "",
    phoneNumber: user?.profile?.phoneNumber ?? "",
    githubUsername: user?.githubUsername ?? "",
    handle: user?.profile?.handle ?? "",
    isPublic: user?.profile?.isPublic ?? false,
  });

  useEffect(() => {
    setForm({
      name: user?.name ?? "",
      bio: user?.profile?.bio ?? "",
      phoneNumber: user?.profile?.phoneNumber ?? "",
      githubUsername: user?.githubUsername ?? "",
      handle: user?.profile?.handle ?? "",
      isPublic: user?.profile?.isPublic ?? false,
    });
  }, [user]);

  const mutation = useMutation({
    mutationFn: () => api.patch<ApiResponse<unknown>>("/api/profile/update", form),
    onSuccess: () => {
      toast.success("Profile updated");
      if (user) {
        setUser({
          ...user,
          name: form.name,
          githubUsername: form.githubUsername || null,
          profile: user.profile
            ? {
                ...user.profile,
                bio: form.bio || null,
                phoneNumber: form.phoneNumber || null,
                handle: form.handle || null,
                isPublic: form.isPublic,
              }
            : user.profile,
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const avatarMutation = useMutation({
    mutationFn: async () => {
      if (!avatarFile) return null;
      const formData = new FormData();
      formData.append("file", avatarFile);
      return api.post("/api/profile/avatar", formData);
    },
    onSuccess: () => {
      toast.success("Avatar updated");
      if (user && avatarPreview) {
        setUser({ ...user, avatar: avatarPreview });
      }
      setAvatarFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: () => api.delete("/api/profile/avatar"),
    onSuccess: () => {
      toast.success("Avatar removed");
      if (user) {
        setUser({ ...user, avatar: null });
      }
      setAvatarFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid w-full gap-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
          <CardDescription>Your display name, handle, and bio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mb-2 flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4 md:flex-row md:items-center">
            <div className="relative">
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt={user?.name ?? "Avatar"} className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="size-8 text-muted-foreground" />
                )}
              </div>
              <label
                htmlFor="settings-avatar-upload"
                className="absolute -bottom-1 -right-1 inline-flex cursor-pointer items-center justify-center rounded-full border border-border bg-background p-2 shadow-sm transition hover:bg-muted"
              >
                <Camera className="size-4" />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Avatar and phone number are required before registering for contests and hackathons.
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <input
                id="settings-avatar-upload"
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <Button type="button" variant="outline" onClick={() => avatarMutation.mutate()} disabled={!avatarFile || avatarMutation.isPending}>
                {avatarFile ? "Save avatar" : "Choose avatar"}
              </Button>
              {user?.avatar ? (
                <Button type="button" variant="ghost" onClick={() => deleteAvatarMutation.mutate()} disabled={deleteAvatarMutation.isPending}>
                  <Trash2 className="mr-2 size-4" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Handle</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  value={form.handle}
                  onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                  className="pl-7"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3}
              placeholder="Tell us a bit about yourself..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>GitHub username</Label>
            <Input
              value={form.githubUsername}
              onChange={(e) => setForm((f) => ({ ...f, githubUsername: e.target.value }))}
              placeholder="your-github-username"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Phone number</Label>
            <Input
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              placeholder="Required for contest and hackathon registrations"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Public profile</p>
              <p className="text-xs text-muted-foreground">Allow anyone with the link to view your profile</p>
            </div>
            <Switch
              checked={form.isPublic}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
