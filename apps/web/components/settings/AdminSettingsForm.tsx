"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Clock, ShieldCheck } from "lucide-react";

export function AdminSettingsForm() {
  const tools = [
    {
      icon: ShieldCheck,
      title: "User management",
      description: "Create and manage users, roles, and access.",
      href: "/admin/users",
    },
    {
      icon: BarChart3,
      title: "Platform analytics",
      description: "View platform-wide usage and performance metrics.",
      href: "/admin/analytics",
    },
    {
      icon: Clock,
      title: "Reminder job monitor",
      description: "Inspect scheduled notifications and failed reminder jobs.",
      href: "/admin/reminders",
    },
  ];

  return (
    <div className="grid w-full max-w-3xl gap-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Platform controls</CardTitle>
          <CardDescription>Quick links to administrative tools.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tools.map((tool) => (
            <div
              key={tool.href}
              className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-muted/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <tool.icon className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{tool.title}</p>
                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={tool.href}>
                  Open <ArrowRight className="ml-1 size-3" />
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
