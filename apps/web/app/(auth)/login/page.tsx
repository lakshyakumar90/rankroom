"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@repo/validators";
import type { z } from "zod";
import { motion } from "framer-motion";
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
import { PasswordInput } from "@/components/ui/password-input";

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

      router.replace(targetRoute);
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
        <motion.div 
          initial="hidden" 
          animate="show" 
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } }
          }}
          className="grid gap-4 sm:grid-cols-3"
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
            <FeatureTile
              icon={ChartNoAxesCombined}
              title="Progress snapshots"
              description="See rank, streaks, and subject health without digging through menus."
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
            <FeatureTile
              icon={ShieldCheck}
              title="Reliable sessions"
              description="Fresh tokens are used immediately, so sign-in and sync stay in step."
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
            <FeatureTile
              icon={Sparkles}
              title="Calmer workspace"
              description="Sharper hierarchy, better contrast, and consistent surfaces across the app."
            />
          </motion.div>
        </motion.div>
      }
      form={
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Card className="rounded-xl border-border/70 bg-card/90 shadow-sm backdrop-blur-md">
            <CardHeader className="flex flex-col gap-4 p-8 pb-0 sm:p-10 sm:pb-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                    <Code2 className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
                    <CardDescription>Use your RankRoom account to continue.</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full px-3 py-1 font-medium bg-background">
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
                    className="h-12 rounded-xl bg-background/50"
                    {...register("email")}
                  />
                </Field>

                <Field label="Password" htmlFor="password" error={errors.password?.message}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-12 rounded-xl bg-background/50"
                    {...register("password")}
                  />
                </Field>

                <Button type="submit" size="lg" className="mt-4 w-full rounded-xl h-12 shadow-md shadow-primary/20" disabled={loading}>
                  {loading ? <Loader2 className="size-5 mr-2 animate-spin" /> : null}
                  {!loading && "Sign in to RankRoom"}
                  {!loading && <ArrowRight className="size-4 ml-2" />}
                </Button>
              </form>

              <div className="mt-8 flex items-center justify-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
                <span>New here?</span>
                <Link href="/register" className="font-semibold text-foreground hover:text-primary transition-colors">
                  Create your account
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
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
