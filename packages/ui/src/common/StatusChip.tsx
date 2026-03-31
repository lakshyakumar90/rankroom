"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Clock, Code2, Database, Loader2, XCircle } from "lucide-react";
import type { Verdict } from "@repo/types";

const statusChipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-colors",
  {
    variants: {
      verdict: {
        AC: "border-transparent bg-green-400/10 text-green-400",
        WA: "border-transparent bg-red-400/10 text-red-400",
        TLE: "border-transparent bg-yellow-400/10 text-yellow-400",
        MLE: "border-transparent bg-orange-400/10 text-orange-400",
        RE: "border-transparent bg-red-500/10 text-red-500",
        CE: "border-transparent bg-purple-400/10 text-purple-400",
        PENDING: "border-transparent bg-blue-400/10 text-blue-400",
        JUDGING: "border-transparent bg-blue-400/10 text-blue-400",
      },
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "px-4 py-2 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

type StatusChipProps = VariantProps<typeof statusChipVariants> & {
  verdict: Verdict;
};

function getStatusIcon(verdict: Verdict, size: NonNullable<StatusChipProps["size"]>) {
  const className = size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  switch (verdict) {
    case "AC":
      return <CheckCircle2 className={className} />;
    case "WA":
      return <XCircle className={className} />;
    case "TLE":
      return <Clock className={className} />;
    case "MLE":
      return <Database className={className} />;
    case "RE":
      return <AlertCircle className={className} />;
    case "CE":
      return <Code2 className={className} />;
    default:
      return <Loader2 className={`${className} animate-spin`} />;
  }
}

export function StatusChip({ verdict, size = "md" }: StatusChipProps) {
  const resolvedSize = size ?? "md";
  return (
    <span className={statusChipVariants({ verdict, size: resolvedSize })}>
      {getStatusIcon(verdict, resolvedSize)}
      <span>{verdict}</span>
    </span>
  );
}
