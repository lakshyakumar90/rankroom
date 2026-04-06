"use client";

import { Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeEditor, type CodeEditorRef } from "@repo/ui/editor/CodeEditor";

const LANGUAGE_ORDER = ["python", "cpp", "c"] as const;

const LANGUAGE_LABELS: Record<(typeof LANGUAGE_ORDER)[number], string> = {
  python: "Python",
  cpp: "C++",
  c: "C",
};

interface EditorPanelProps {
  editorRef: React.RefObject<CodeEditorRef | null>;
  language: string;
  fontSize: number;
  code: string;
  onLanguageChange: (value: string) => void;
  onFontSizeChange: (size: number) => void;
  onCodeChange: (value: string) => void;
  onResetCode: () => void;
}

export function EditorPanel({
  editorRef,
  language,
  fontSize,
  code,
  onLanguageChange,
  onFontSizeChange,
  onCodeChange,
  onResetCode,
}: EditorPanelProps) {
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_ORDER.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(fontSize)} onValueChange={(value) => onFontSizeChange(Number(value))}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[12, 13, 14, 15, 16].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onResetCode}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigator.clipboard.writeText(code)}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          ref={editorRef}
          language={language}
          value={code}
          onChange={onCodeChange}
          fontSize={fontSize}
          className="h-full rounded-none border-0"
          minHeight={600}
        />
      </div>
    </div>
  );
}
