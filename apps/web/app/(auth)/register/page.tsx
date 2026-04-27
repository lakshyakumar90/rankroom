"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema } from "@repo/validators";
import type { z } from "zod";
import { ArrowRight, Code2, Loader2, Orbit, ShieldCheck, UserRoundPlus, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { getDefaultRouteForRole } from "@/lib/route-access";
import { AuthShell } from "@/components/common/auth-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "STUDENT" },
  });

  async function onSubmit(data: RegisterFormData) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { name: data.name, full_name: data.name, role: data.role } },
      });

      if (authError) throw authError;

      if (!authData.session) {
        toast.success("Check your email to confirm your account");
        router.push("/login");
        return;
      }

      const response = await fetch("/api/auth/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({ name: data.name, role: data.role }),
      });

      if (!response.ok) throw new Error("Failed to create user profile");

      const result = await response.json();
      if (!result.success || !result.data) throw new Error("Failed to create user profile");

      setUser(result.data);
      toast.success("Account created");
      router.replace(getDefaultRouteForRole(result.data.role));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      badge="Built for modern campus cohorts"
      title="Create your space for practice, competition, and academic tracking."
      description="The onboarding flow now matches the rest of the app with steadier rhythm, sharper card hierarchy, and cleaner form treatment."
      reverse
      hero={
        <div className="grid gap-4 sm:grid-cols-3">
          <RegisterTile
            icon={Orbit}
            title="Contest ready"
            description="Move from class tasks to leaderboards without switching tools."
          />
          <RegisterTile
            icon={ShieldCheck}
            title="Profile synced"
            description="Fresh signup tokens are forwarded straight into app registration."
          />
          <RegisterTile
            icon={Code2}
            title="Built for coders"
            description="Practice problems, submissions, hackathons, and campus analytics in one flow."
          />
        </div>
      }
      form={
        <Card className="rounded-xl border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-col gap-4 p-8 pb-0 sm:p-10 sm:pb-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <UserRoundPlus className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Create your account</CardTitle>
                  <CardDescription>Start with a student workspace and personalize it later.</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Student onboarding
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-8 sm:p-10 sm:pt-8">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              <Field label="Full name" htmlFor="name" error={errors.name?.message}>
                <Input id="name" placeholder="John Doe" className="h-11 rounded-xl" {...register("name")} />
              </Field>

              <Field label="Email" htmlFor="email" error={errors.email?.message}>
                <Input id="email" type="email" placeholder="you@example.com" className="h-11 rounded-xl" {...register("email")} />
              </Field>

              <Field label="Password" htmlFor="password" error={errors.password?.message}>
                <PasswordInput id="password" placeholder="Minimum 8 characters" className="h-11 rounded-xl" autoComplete="new-password" {...register("password")} />
              </Field>

              <Button type="submit" size="lg" className="mt-2 w-full rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                Create account
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              <span>Already onboarded?</span>
              <Link href="/login" className="font-medium text-foreground hover:text-primary">
                Sign in instead
              </Link>
            </div>
          </CardContent>
        </Card>
      }
    />
  );
}

function RegisterTile({
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
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
