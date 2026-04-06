"use client";

import { useAuthStore } from "@/store/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Role } from "@repo/types";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { TeacherSettingsForm } from "@/components/settings/TeacherSettingsForm";
import { AdminSettingsForm } from "@/components/settings/AdminSettingsForm";
import { PageContainer, PageHeader } from "@/components/common/page-shell";
import ProfileEditPage from "@/components/settings/ProfileEditForm";
import {
  User,
  Code2,
  Zap,
  FolderKanban,
  Trophy,
  FileText,
  ShieldCheck,
  Bell,
  GraduationCap,
  Building2,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuthStore();

  const isTeacher = user?.role === Role.TEACHER;
  const isDeptHead = user?.role === Role.DEPARTMENT_HEAD;
  const isAdmin = user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, preferences, and role-specific options."
      />

      <Tabs
        defaultValue="basic"
        orientation="vertical"
        className="mt-8 grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] md:items-start md:gap-8"
      >
        <TabsList className="flex h-auto w-full shrink-0 flex-col justify-start gap-1 rounded-2xl border border-border/50 bg-background/80 p-3 backdrop-blur md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:w-64 md:overflow-y-auto">
          <div className="px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Profile
            </p>
          </div>
          <TabsTrigger
            value="basic"
            className="w-full justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-border data-[state=active]:bg-muted/80 data-[state=active]:shadow-none hover:bg-muted/50"
          >
            <User className="size-4" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger
            value="platforms"
            className="w-full justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-border data-[state=active]:bg-muted/80 data-[state=active]:shadow-none hover:bg-muted/50"
          >
            <Code2 className="size-4" />
            Coding Platforms
          </TabsTrigger>
          <TabsTrigger
            value="skills"
            className="w-full justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-border data-[state=active]:bg-muted/80 data-[state=active]:shadow-none hover:bg-muted/50"
          >
            <Zap className="size-4" />
            Skills
          </TabsTrigger>
          <TabsTrigger
            value="projects"
            className="w-full justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-border data-[state=active]:bg-muted/80 data-[state=active]:shadow-none hover:bg-muted/50"
          >
            <FolderKanban className="size-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger
            value="achievements"
            className="w-full justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-border data-[state=active]:bg-muted/80 data-[state=active]:shadow-none hover:bg-muted/50"
          >
            <Trophy className="size-4" />
            Achievements
          </TabsTrigger>
          <TabsTrigger
            value="resume"
            className="w-full justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-border data-[state=active]:bg-muted/80 data-[state=active]:shadow-none hover:bg-muted/50"
          >
            <FileText className="size-4" />
            Resume
          </TabsTrigger>
          <TabsTrigger
            value="privacy"
            className="w-full justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-border data-[state=active]:bg-muted/80 data-[state=active]:shadow-none hover:bg-muted/50"
          >
            <ShieldCheck className="size-4" />
            Privacy
          </TabsTrigger>

          <div className="mt-4 px-3 py-2 border-t border-border/50 pt-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Account
            </p>
          </div>
          <TabsTrigger
            value="notifications"
            className="w-full justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-border data-[state=active]:bg-muted/80 data-[state=active]:shadow-none hover:bg-muted/50"
          >
            <Bell className="size-4" />
            Notifications
          </TabsTrigger>

          {(isTeacher || isDeptHead || isAdmin) && (
            <>
              <div className="mt-4 px-3 py-2 border-t border-border/50 pt-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Management
                </p>
              </div>
              {isTeacher && (
                <TabsTrigger
                  value="academic"
                  className="w-full justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-border data-[state=active]:bg-muted/80 data-[state=active]:shadow-none hover:bg-muted/50"
                >
                  <GraduationCap className="size-4" />
                  Academic Hub
                </TabsTrigger>
              )}
              {(isDeptHead || isAdmin) && (
                <TabsTrigger
                  value="platform"
                  className="w-full justify-start gap-2.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all data-[state=active]:border-border data-[state=active]:bg-muted/80 data-[state=active]:shadow-none hover:bg-muted/50"
                >
                  <Building2 className="size-4" />
                  Platform Admin
                </TabsTrigger>
              )}
            </>
          )}
        </TabsList>

        <div className="min-w-0 max-w-4xl md:col-start-2">
          <TabsContent value="basic" className="m-0">
            <div className="bg-card w-full rounded-2xl border border-border p-6 md:p-8 overflow-hidden">
              <ProfileEditPage initialTab="basic" />
            </div>
          </TabsContent>
          <TabsContent value="platforms" className="m-0">
            <div className="bg-card w-full rounded-2xl border border-border p-6 md:p-8 overflow-hidden">
              <ProfileEditPage initialTab="platforms" />
            </div>
          </TabsContent>
          <TabsContent value="skills" className="m-0">
            <div className="bg-card w-full rounded-2xl border border-border p-6 md:p-8 overflow-hidden">
              <ProfileEditPage initialTab="skills" />
            </div>
          </TabsContent>
          <TabsContent value="projects" className="m-0">
            <div className="bg-card w-full rounded-2xl border border-border p-6 md:p-8 overflow-hidden">
              <ProfileEditPage initialTab="projects" />
            </div>
          </TabsContent>
          <TabsContent value="achievements" className="m-0">
            <div className="bg-card w-full rounded-2xl border border-border p-6 md:p-8 overflow-hidden">
              <ProfileEditPage initialTab="achievements" />
            </div>
          </TabsContent>
          <TabsContent value="resume" className="m-0">
            <div className="bg-card w-full rounded-2xl border border-border p-6 md:p-8 overflow-hidden">
              <ProfileEditPage initialTab="resume" />
            </div>
          </TabsContent>
          <TabsContent value="privacy" className="m-0">
            <div className="bg-card w-full rounded-2xl border border-border p-6 md:p-8 overflow-hidden">
              <ProfileEditPage initialTab="privacy" />
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="m-0">
            <NotificationSettings />
          </TabsContent>

          {isTeacher && (
            <TabsContent value="academic" className="m-0">
              <TeacherSettingsForm />
            </TabsContent>
          )}

          {(isDeptHead || isAdmin) && (
            <TabsContent value="platform" className="m-0">
              <AdminSettingsForm />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </PageContainer>
  );
}
