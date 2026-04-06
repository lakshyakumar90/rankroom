"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, GraduationCap, Users, Users2 } from "lucide-react";

interface SectionOverview {
  id: string;
  name: string;
  code: string;
  semester: number;
  academicYear: string;
  department: { id: string; name: string };
  coordinator?: { id: string; name: string } | null;
  coordinators?: Array<{ id: string; name: string }>;
  stats: { enrollmentCount: number; subjectCount: number; teacherCount: number; coordinatorCount: number };
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SectionOverviewTab({ section }: { section: SectionOverview }) {
  const coordinators = section.coordinators ?? (section.coordinator ? [section.coordinator] : []);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Enrolled students" value={section.stats.enrollmentCount} />
        <StatCard icon={BookOpen} label="Active subjects" value={section.stats.subjectCount} />
        <StatCard icon={GraduationCap} label="Teachers" value={section.stats.teacherCount} />
        <StatCard icon={Users2} label="Coordinators" value={section.stats.coordinatorCount} />
      </div>

      {coordinators.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium mb-3">Class Coordinators</p>
            <div className="flex flex-wrap gap-2">
              {coordinators.map((c) => (
                <Badge key={c.id} variant="secondary">{c.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Section code</p>
            <p className="mt-1 font-mono font-semibold">{section.code}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Semester</p>
            <p className="mt-1 font-semibold">{section.semester}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Academic year</p>
            <p className="mt-1 font-semibold">{section.academicYear}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Department</p>
            <p className="mt-1 font-semibold">{section.department.name}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
