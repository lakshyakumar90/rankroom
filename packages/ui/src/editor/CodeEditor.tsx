"use client";

import dynamic from "next/dynamic";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { ComponentProps } from "react";

const MonacoEditor = dynamic(async () => import("@monaco-editor/react").then((mod) => mod.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-80 animate-pulse flex-col gap-3 bg-card px-4 py-3">
      <div className="h-4 w-32 rounded-md bg-muted" />
      <div className="h-full rounded-lg bg-muted/60" />
    </div>
  ),
});

export interface CodeEditorRef {
  getValue: () => string;
  setValue: (value: string) => void;
}

export interface CodeEditorProps {
  language: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  fontSize?: number;
  readOnly?: boolean;
  className?: string;
  minHeight?: number;
}

type MonacoProps = ComponentProps<typeof MonacoEditor>;

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(function CodeEditor(
  {
    language,
    value,
    defaultValue = "",
    onChange,
    fontSize = 14,
    readOnly = false,
    className = "",
    minHeight = 400,
  },
  ref
) {
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => internalValue,
      setValue: (nextValue: string) => {
        setInternalValue(nextValue);
        onChange?.(nextValue);
      },
    }),
    [internalValue, onChange]
  );

  const editorOptions = useMemo<NonNullable<MonacoProps["options"]>>(
    () => ({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      lineNumbers: "on",
      renderLineHighlight: "line",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontLigatures: true,
      tabSize: 2,
      automaticLayout: true,
      padding: { top: 12, bottom: 12 },
      readOnly,
    }),
    [readOnly]
  );

  return (
    <div className={`h-full overflow-hidden rounded-lg border border-border bg-card ${className}`}>
      <MonacoEditor
        height={typeof minHeight === "number" ? `${minHeight}px` : minHeight}
        defaultLanguage={language}
        language={language}
        theme="vs-dark"
        value={internalValue}
        onChange={(nextValue) => {
          const resolved = nextValue ?? "";
          setInternalValue(resolved);
          onChange?.(resolved);
        }}
        options={{
          ...editorOptions,
          fontSize,
        }}
      />
    </div>
  );
});
