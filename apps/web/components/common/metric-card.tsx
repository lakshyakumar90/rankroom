import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
  loading = false,
}: {
  title: string;
  value: string | number | null;
  description?: string;
  icon: LucideIcon;
  tone?: "default" | "accent" | "success" | "warning";
  loading?: boolean;
}) {
  const toneClasses = {
    default: "bg-secondary text-secondary-foreground",
    accent: "bg-accent text-accent-foreground",
    success: "bg-primary/12 text-primary",
    warning: "bg-secondary text-foreground",
  };

  return (
    <Card className="rounded-2xl border-border/70 bg-card/90 shadow-sm">
      <CardContent className="flex min-w-0 items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-9 w-28 rounded-lg" />
          ) : (
            <p className="wrap-break-word text-[clamp(1.3rem,2.1vw,1.75rem)] font-semibold leading-tight tracking-tight">{value ?? "—"}</p>
          )}
          {description ? <p className="wrap-break-word text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            toneClasses[tone]
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
