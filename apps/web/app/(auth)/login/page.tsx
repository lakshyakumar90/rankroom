"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@repo/validators";
import type { z } from "zod";
import { ArrowRight, ChartNoAxesCombined, Code2, Loader2, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { getDefaultRouteForRole, normalizeInternalPath } from "@/lib/route-access";
import { AuthShell } from "@/components/common/auth-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormData = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError || !authData.user || !authData.session) {
        throw new Error(authError?.message ?? "Invalid email or password");
      }

      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.session.access_token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to load user profile");

      const result = await response.json();
      if (!result.success || !result.data) throw new Error("Failed to load user profile");

      setUser(result.data);
      toast.success("Welcome back");

      const targetRoute = redirectedFrom
        ? normalizeInternalPath(redirectedFrom)
        : getDefaultRouteForRole(result.data.role);

      router.push(targetRoute);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      badge="RankRoom command center"
      title="Sign in and pick up exactly where your momentum stopped."
      description="One workspace for coding practice, attendance, grades, contests, and academic operations, now with a cleaner and more cohesive UI system."
      hero={
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureTile
            icon={ChartNoAxesCombined}
            title="Progress snapshots"
            description="See rank, streaks, and subject health without digging through menus."
          />
          <FeatureTile
            icon={ShieldCheck}
            title="Reliable sessions"
            description="Fresh tokens are used immediately, so sign-in and sync stay in step."
          />
          <FeatureTile
            icon={Sparkles}
            title="Calmer workspace"
            description="Sharper hierarchy, better contrast, and consistent surfaces across the app."
          />
        </div>
      }
      form={
        <Card className="rounded-xl border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-col gap-4 p-8 pb-0 sm:p-10 sm:pb-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <Code2 className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Welcome back</CardTitle>
                  <CardDescription>Use your RankRoom account to continue.</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Secure login
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-8 sm:p-10 sm:pt-8">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              <Field label="Email" htmlFor="email" error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="h-11 rounded-xl"
                  {...register("email")}
                />
              </Field>

              <Field label="Password" htmlFor="password" error={errors.password?.message}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs font-medium text-primary">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 rounded-xl"
                  {...register("password")}
                />
              </Field>

              <Button type="submit" size="lg" className="mt-2 w-full rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                Sign in to RankRoom
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              <span>New here?</span>
              <Link href="/register" className="font-medium text-foreground hover:text-primary">
                Create your account
              </Link>
            </div>
          </CardContent>
        </Card>
      }
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}

function FeatureTile({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="surface-inset p-4">
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-background text-foreground shadow-sm">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {label === "Password" ? null : <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
