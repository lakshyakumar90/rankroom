import { cn } from "@/lib/utils";

interface ScopeBadgeProps {
  scope: "GLOBAL" | "DEPARTMENT" | "SECTION";
}

const SCOPE_STYLES: Record<ScopeBadgeProps["scope"], { label: string; className: string }> = {
  GLOBAL: {
    label: "Global",
    className: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  },
  DEPARTMENT: {
    label: "Department",
    className: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  },
  SECTION: {
    label: "Section",
    className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  },
};

export function ScopeBadge({ scope }: ScopeBadgeProps) {
  const config = SCOPE_STYLES[scope];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
