"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LifeBuoy, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/common/auth-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSent(true);
      toast.success("Password reset email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      badge="Account recovery"
      title="Reset access without leaving the flow."
      description="This recovery screen now uses the same card rhythm, spacing scale, and visual hierarchy as the rest of the authentication experience."
      hero={
        <div className="grid gap-4 sm:grid-cols-3">
          <RecoveryTile icon={MailCheck} title="Fast handoff" description="Send the reset link directly to the email connected to your account." />
          <RecoveryTile icon={ShieldCheck} title="Secure redirect" description="Recovery links return you to the app in a controlled, trusted flow." />
          <RecoveryTile icon={LifeBuoy} title="Less friction" description="Everything stays in one simple, readable form with clear next steps." />
        </div>
      }
      form={
        <Card className="rounded-xl border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="p-8 pb-0 sm:p-10 sm:pb-0">
            <Badge variant="outline" className="mb-4 w-fit rounded-full px-3 py-1">
              Password recovery
            </Badge>
            <CardTitle className="text-2xl">Reset password</CardTitle>
            <CardDescription>
              {sent
                ? "We have sent a recovery link to your email."
                : "Enter the email associated with your account to receive a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-8 sm:p-10 sm:pt-8">
            {!sent ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
                <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  Send reset link
                </Button>
              </form>
            ) : (
              <div className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                Check your inbox at <span className="font-medium text-foreground">{email}</span> and follow the link to reset your password.
              </div>
            )}

            <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
              Back to login
            </Link>
          </CardContent>
        </Card>
      }
    />
  );
}

function RecoveryTile({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof MailCheck;
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
