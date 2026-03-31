"use client";

import * as React from "react";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
}

function Avatar({ src, name, size = "md", className, ...props }: AvatarProps) {
  const sizeClasses = { sm: "size-7 text-xs", md: "size-9 text-sm", lg: "size-14 text-base" };

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium uppercase",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? "Avatar"} className="size-full object-cover" />
      ) : (
        <span className="text-muted-foreground">{name ? getInitials(name) : "?"}</span>
      )}
    </div>
  );
}

export { Avatar };
