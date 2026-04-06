"use client";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

interface ProblemWorkspaceProps {
  navbar: React.ReactNode;
  leftPanel: React.ReactNode;
  editorPanel: React.ReactNode;
  bottomPanel: React.ReactNode;
}

/** Full-screen LeetCode-style 3-panel workspace:
 *  [Left: Description] | [Right-top: Editor / Right-bottom: TestCase+Results]
 */
export function ProblemWorkspace({ navbar, leftPanel, editorPanel, bottomPanel }: ProblemWorkspaceProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {navbar}

      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* Left: Problem description / submissions / hints */}
        <ResizablePanel defaultSize={40} minSize={28} maxSize={55}>
          <div className="h-full overflow-hidden">{leftPanel}</div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Editor + Test cases */}
        <ResizablePanel defaultSize={60} minSize={45} maxSize={72}>
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Editor */}
            <ResizablePanel defaultSize={65} minSize={40}>
              <div className="h-full overflow-hidden">{editorPanel}</div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Bottom: TestCase / Result / Console */}
            <ResizablePanel defaultSize={35} minSize={10} collapsible collapsedSize={5}>
              <div className="h-full overflow-hidden">{bottomPanel}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
