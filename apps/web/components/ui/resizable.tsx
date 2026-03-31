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
    <Separator className={cn("relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[separator-orientation=horizontal]:h-px data-[separator-orientation=horizontal]:w-full", className)} {...props}>
      {withHandle && <GripVertical className="h-4 w-4 text-muted-foreground" />}
    </Separator>
  );
}
