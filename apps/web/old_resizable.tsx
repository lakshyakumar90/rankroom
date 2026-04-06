"use client";

import type * as React from "react";
import { Group, Panel, Separator, type GroupImperativeHandle, type GroupProps } from "react-resizable-panels";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type ResizablePanelGroupProps = Omit<GroupProps, "orientation"> & {
  direction: "horizontal" | "vertical";
  autoSaveId?: string;
};

export const ResizablePanelGroup = ({ className, direction, autoSaveId, ...props }: ResizablePanelGroupProps) => (
  <Group className={cn("flex h-full w-full data-[group-orientation=vertical]:flex-col", className)} orientation={direction} autoSave={autoSaveId} {...props} />
);

export const ResizablePanel = Panel;
export type ResizablePanelHandleRef = GroupImperativeHandle;

export function ResizableHandle({ className, withHandle = false, ...props }: React.ComponentProps<typeof Separator> & { withHandle?: boolean }) {
  return (
    <Separator
      className={cn(
        "group relative flex w-1.5 items-center justify-center bg-neutral-800 transition-colors hover:bg-blue-500",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "data-[separator-orientation=horizontal]:h-1.5 data-[separator-orientation=horizontal]:w-full",
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div className="h-8 w-0.5 rounded bg-neutral-600 transition-colors group-hover:bg-white/70" />
      ) : (
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      )}
    </Separator>
  );
}
