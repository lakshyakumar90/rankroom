"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ExternalLink, Wrench } from "lucide-react";

export function StudentSettingsForm() {
  return (
    <div className="grid w-full max-w-3xl gap-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Skills profile</CardTitle>
          <CardDescription>
            Manage your technical skills to improve event eligibility matching.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/skills">
              <Wrench className="mr-2 size-4" />
              Manage skills
              <ExternalLink className="ml-2 size-3" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
